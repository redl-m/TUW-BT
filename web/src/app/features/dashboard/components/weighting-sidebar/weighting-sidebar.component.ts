import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidateStore } from '../../../../core/state/candidate.store';
import { VisualSliderComponent } from '../../../../shared/ui/visual-slider/visual-slider.component';

@Component({
  selector: 'app-weighting-sidebar',
  standalone: true,
  imports: [CommonModule, VisualSliderComponent],
  styleUrls: ['./weighting-sidebar.component.scss'],
  template: `
    <div class="sidebar-card">

      <div class="sidebar-header">
        <div class="header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-8h6m2 12h6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="header-text">
          <h2>Custom Weights</h2>
          <p>Adjust evaluation criteria</p>
        </div>
      </div>

      <div class="sliders-container">
        <app-visual-slider
          *ngFor="let key of weightKeys"
          [label]="key"
          [description]="getFeatureDescription(key)"
          [value]="store.jobWeights()[key]"
          [impactPercentage]="getImpactPercentage(key)"
          (valueChange)="onSliderChange(key, $event)">
        </app-visual-slider>
      </div>

      <div class="sidebar-footer">
        <p>Adjust these weights to prioritize what matters most for this role. Scores will automatically update based on your preferences.</p>
      </div>

    </div>
  `
})

/**
 * Component for displaying the weighting sidebar.
 */
export class WeightingSidebarComponent {
  store = inject(CandidateStore);

  get weightKeys(): string[] {
    return Object.keys(this.store.jobWeights());
  }

  // Dynamically calculate the % impact based on the sum of all current sliders
  getImpactPercentage(key: string): number {
    const weights = this.store.jobWeights();
    const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;
    return Math.round((weights[key] / total) * 100);
  }

  // Helper map to provide the subtitles
  getFeatureDescription(key: string): string {
    const descriptions: Record<string, string> = {
      'Experience': 'Years of relevant industry experience',
      'Education': 'Academic background and qualifications',
      'Skill Overlap': 'Match with required technical skills',
      'Leadership': 'Team management and leadership abilities',
      'Company Background': 'Previous employers and prestige',
      'Retention/Stability': 'Job tenure and commitment history',
      'Cultural Fit': 'Alignment with company values'
    };
    return descriptions[key] || 'Dynamic feature extracted by LLM';
  }

  onSliderChange(feature: string, newValue: number) {
    this.store.updateWeight(feature, newValue);
  }
}

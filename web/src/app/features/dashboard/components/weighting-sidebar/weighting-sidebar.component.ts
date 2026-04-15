import { Component, inject, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidateStore } from '../../../../core/state/candidate.store';
import { VisualSliderComponent } from '../../../../shared/ui/visual-slider/visual-slider.component';
import { ApiService } from '../../../../core/services/api.service';
import { Subject, debounceTime, takeUntil } from 'rxjs';

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

      <div class="sliders-container" [class.disabled-sliders]="disabled">
        <div *ngFor="let key of weightKeys"
             class="slider-wrapper transition-all duration-300 rounded-lg border-2 border-transparent"
             [class.highlighted-slider]="isHighlighted(key)">

          <app-visual-slider
            [label]="getDisplayName(key)"
            [description]="getFeatureDescription(key)"
            [value]="store.jobWeights()[key]"
            [impactPercentage]="getImpactPercentage(key)"
            [disabled]="disabled"
            (valueChange)="onSliderChange(key, $event)">
          </app-visual-slider>

        </div>
      </div>

      <div *ngIf="disabled" class="loading-text">
        LLM is extracting baseline weights...
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
export class WeightingSidebarComponent implements OnInit, OnDestroy {

  @Input() disabled: boolean = false;
  store = inject(CandidateStore);
  apiService = inject(ApiService);

  private sliderSubject = new Subject<void>();
  private destroy$ = new Subject<void>();

  ngOnInit() {
    // Listen to physical slider changes and debounce them by 800ms
    this.sliderSubject.pipe(
      debounceTime(800),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.apiService.updateWeights(this.store.jobWeights()).subscribe({
        next: () => console.log('✅ New weights posted to backend!'),
        error: (err) => console.error('❌ Failed to update weights', err)
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Display names
  private readonly featureDisplayNames: Record<string, string> = {
    'years_of_experience': 'Years of Experience',
    'education_level': 'Education Level',
    'projects_count': 'Projects Count',
    'job_hopping': 'Job Hopping',
    'technical_skills': 'Technical Skills',
    'structural_adherence': 'Structural Adherence',
    'adaptive_fluidity': 'Adaptive Fluidity',
    'interpersonal_influence': 'Interpersonal Influence',
    'execution_velocity': 'Execution Velocity',
    'psychological_resilience': 'Psychological Resilience'
  };

  get weightKeys(): string[] {
    return Object.keys(this.store.jobWeights());
  }

  getDisplayName(key: string): string {
    return this.featureDisplayNames[key] || this.formatUnknownKey(key);
  }

  private formatUnknownKey(key: string): string {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
      'years_of_experience': 'Total years of professional experience',
      'education_level': 'Highest education level achieved',
      'projects_count': 'Number of distinct projects completed',
      'structural_adherence': 'Ability to follow strict protocols and thrive in established hierarchies',
      'adaptive_fluidity': 'Capacity to navigate ambiguity and function without clear instructions',
      'interpersonal_influence': 'Ability to persuade stakeholders and drive alignment without direct authority',
      'execution_velocity': 'Bias for action, prioritizing rapid output over absolute perfection',
      'psychological_resilience': 'Maintains emotional stability through setbacks, criticism, and delayed rewards'
    };

    return descriptions[key] || 'Dynamic feature extracted by LLM';
  }

  onSliderChange(feature: string, newValue: number) {
    this.store.updateWeight(feature, newValue);
    this.sliderSubject.next();
  }

  isHighlighted(key: string): boolean {
    return this.store.highlightedFeatures().includes(key);
  }
}

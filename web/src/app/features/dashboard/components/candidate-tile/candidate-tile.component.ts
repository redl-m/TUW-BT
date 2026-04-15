import {Component, inject, Input, OnChanges, SimpleChanges} from '@angular/core';import { CommonModule } from '@angular/common';
import { CandidateDetailComponent } from '../../../candidate-detail/candidate-detail.component';
import { Candidate } from '../../../../core/models/candidate.model';
import {CandidateStore} from '../../../../core/state/candidate.store';

@Component({
  selector: 'app-candidate-tile',
  standalone: true,
  imports: [CommonModule, CandidateDetailComponent],
  styleUrls: ['./candidate-tile.component.scss'],
  template: `
    <div *ngIf="candidate.info_flag"
         class="floating-info-badge group"
         [class.auto-expand]="isAutoExpanding"
         (mouseenter)="onHoverDeviation(true)"
         (mouseleave)="onHoverDeviation(false)">

      <div class="info-icon-container">
        <div class="info-icon">i</div>
      </div>

      <div class="info-content-container">

        <div class="info-header">
          <div class="info-title-row">
            <span class="info-title">Score Insight</span>
            <span class="gap-badge">+{{ totalDeviation | percent:'1.0-1' }} Gap</span>
          </div>
          <span class="info-subtitle">Deviation from baseline</span>
        </div>

        <div class="feature-breakdown">
          <div *ngFor="let feat of deviatingFeaturesWithColors" class="feature-row">

            <div class="feature-labels">
          <span class="feature-name" [title]="formatFeatureName(feat.key)">
            {{ formatFeatureName(feat.key) }}
          </span>
              <span class="feature-value">
            +{{ feat.value | percent:'1.1-1' }}
          </span>
            </div>

            <div class="deviation-bar-track">
              <div class="deviation-bar-fill"
                   [style.background-color]="feat.bgColor"
                   [style.width.%]="feat.percentageOfGap"></div>
            </div>

          </div>
        </div>

      </div>
    </div>

    <div class="candidate-card-wrapper bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-300">

      <div class="candidate-card flex items-center justify-between p-6 gap-6">

        <div class="identity-section flex items-center gap-4 min-w-[200px]">
          <div class="avatar">{{ initials }}</div>
          <div class="info flex flex-col justify-center">
            <span class="rank-badge mb-1">#{{ rank }}</span>

            <h3 class="name text-lg font-semibold text-gray-900" [title]="formattedName">
              {{ formattedName }}
            </h3>

            <span class="text-xs text-gray-500">{{ candidate.features['Job Role'] || 'No job role found' }}</span>
          </div>
        </div>

        <div class="scores-section flex-grow max-w-xl flex flex-col gap-4">
          <div class="score-row flex items-center gap-4">
            <span class="score-label w-24 text-sm font-medium text-gray-600">User Score</span>
            <div class="progress-track flex-grow bg-gray-100 rounded-full h-3 overflow-hidden">
              <div class="progress-fill user-score h-full rounded-full transition-all duration-700"
                   [style.width.%]="(candidate.user_score || 0) * 100"></div>
            </div>
            <span class="score-value w-12 text-right font-semibold text-gray-900">{{ (candidate.user_score || 0) | percent:'1.0-0' }}</span>
          </div>

          <div class="score-row flex items-center gap-4">
            <span class="score-label w-24 text-sm font-medium text-gray-600">Baseline Score</span>
            <div class="progress-track flex-grow bg-gray-100 rounded-full h-3 overflow-hidden">
              <div class="progress-fill ai-score h-full rounded-full transition-all duration-700"
                   [style.width.%]="(candidate.rf_score || 0) * 100"></div>
            </div>
            <span class="score-value w-12 text-right font-semibold text-gray-900">{{ (candidate.rf_score || 0) | percent:'1.0-0' }}</span>
          </div>
        </div>

        <div class="action-section flex items-center gap-4 ml-auto">
          <button
            class="view-btn bg-[#2e1065] text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#1e1b4b] transition-colors flex items-center gap-2 whitespace-nowrap"
            style="font-family: inherit;"
            (click)="toggleExpand()">
            {{ isExpanded ? 'Hide Details' : 'View Details' }}
            <span class="caret" [ngClass]="{'rotate-180': isExpanded}">▼</span>
          </button>
        </div>
      </div>

      <div *ngIf="isExpanded" class="expanded-content border-t border-gray-100">
        <app-candidate-detail [candidate]="candidate"></app-candidate-detail>
      </div>

    </div>
  `
})

/**
 * Component for displaying a candidate tile.
 * @param candidate The candidate object containing the details.
 * @param rank The rank of the candidate.
 */
export class CandidateTileComponent {
  @Input({ required: true }) candidate!: Candidate;
  @Input() rank: number = 1;
  @Input() autoExpand: boolean = false;

  store = inject(CandidateStore);
  isExpanded: boolean = false;
  isAutoExpanding: boolean = false;

  ngOnInit() {
    if (this.autoExpand) {
      this.playAutoExpandAnimation();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['autoExpand'] && !changes['autoExpand'].isFirstChange() && changes['autoExpand'].currentValue === true) {
      this.playAutoExpandAnimation();
    }
  }

  private playAutoExpandAnimation() {
    setTimeout(() => {
      this.isAutoExpanding = true;
      setTimeout(() => {
        this.isAutoExpanding = false;
      }, 4000);
    }, 100);
  }

  /**
   * Format the candidate's name to capitalize the first letter of each word.
   */
  get formattedName(): string {
    if (!this.candidate?.name) return 'Unknown Candidate';
    return this.candidate.name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Extract the first and last letters of the candidate's name.
   */
  get initials(): string {
    const name = this.formattedName.trim();
    if (!name || name === 'Unknown Candidate') return '?';

    // Split the name by spaces and filter out any accidental empty strings
    const parts = name.split(' ').filter(part => part.length > 0);

    if (parts.length >= 2) {
      // First letter of the first word + First letter of the last word
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    // Fallback if they only have one name
    return parts[0][0].toUpperCase();
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
  }

  get topDeviatingFeatures() {
    if (!this.candidate?.deviation_breakdown) return [];
    return Object.entries(this.candidate.deviation_breakdown)
      .map(([key, value]) => ({ key, value }))
      .slice(0, 3); // Display top 3
  }

  /**
   * Computes and returns the total deviation between the user's score and the reference score (rf_score).
   * The result is a non-negative value, which is the difference between user_score and rf_score,
   * or zero if the difference is negative.
   *
   * @return {number} The total deviation, calculated as the positive difference between user_score and rf_score.
   */
  get totalDeviation(): number {
    const userScore = this.candidate.user_score || 0;
    const rfScore = this.candidate.rf_score || 0;
    return Math.max(0, userScore - rfScore);
  }

  /**
   * Map the deviating features to color codes and calculate their exact % of the gap.
   */
  get deviatingFeaturesWithColors() {
    if (!this.candidate?.deviation_breakdown) return [];

    const bgColors = ['#2d1a61', '#752589', '#bf30b6'];

    const features = Object.entries(this.candidate.deviation_breakdown)
      .map(([key, value]) => ({ key, value }))
      .slice(0, 3);

    let accumulatedDeviation = 0;

    const mappedFeatures = features.map((feat, index) => {
      accumulatedDeviation += feat.value;
      return {
        ...feat,
        bgColor: bgColors[index % bgColors.length],
        percentageOfGap: this.totalDeviation > 0 ? (feat.value / this.totalDeviation) * 100 : 0
      };
    });

    const remaining = this.totalDeviation - accumulatedDeviation;
    if (remaining > 0.01 && mappedFeatures.length > 0) {
      mappedFeatures.push({
        key: 'Other adjustments',
        value: remaining,
        bgColor: '#e5e7eb',
        percentageOfGap: (remaining / this.totalDeviation) * 100
      });
    }

    return mappedFeatures;
  }

  formatFeatureName(key: string): string {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  /**
   * Handles the deviation highlights when a hovering event occurs.
   */
  onHoverDeviation(isHovering: boolean): void {
    if (isHovering && this.topDeviatingFeatures.length > 0) {
      const featureKeys = this.topDeviatingFeatures.map(f => f.key);
      this.store.setHighlightedFeatures(featureKeys);
    } else {
      this.store.setHighlightedFeatures([]);
    }
  }
}

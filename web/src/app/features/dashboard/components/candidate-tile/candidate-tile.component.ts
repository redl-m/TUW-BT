import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidateDetailComponent } from '../../../candidate-detail/candidate-detail.component';
import { Candidate } from '../../../../core/models/candidate.model';

@Component({
  selector: 'app-candidate-tile',
  standalone: true,
  imports: [CommonModule, CandidateDetailComponent],
  styleUrls: ['./candidate-tile.component.scss'],
  template: `
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
            <span class="score-label w-24 text-sm font-medium text-gray-600">Your Score</span>
            <div class="progress-track flex-grow bg-gray-100 rounded-full h-3 overflow-hidden">
              <div class="progress-fill user-score h-full rounded-full transition-all duration-700"
                   [style.width.%]="(candidate.user_score || 0) * 100"></div>
            </div>
            <span class="score-value w-12 text-right font-semibold text-gray-900">{{ (candidate.user_score || 0) | percent:'1.0-0' }}</span>
          </div>

          <div class="score-row flex items-center gap-4">
            <span class="score-label w-24 text-sm font-medium text-gray-600">AI Score (RF)</span>
            <div class="progress-track flex-grow bg-gray-100 rounded-full h-3 overflow-hidden">
              <div class="progress-fill ai-score h-full rounded-full transition-all duration-700"
                   [style.width.%]="(candidate.rf_score || 0) * 100"></div>
            </div>
            <span class="score-value w-12 text-right font-semibold text-gray-900">{{ (candidate.rf_score || 0) | percent:'1.0-0' }}</span>
          </div>
        </div>

        <div class="action-section flex items-center gap-4 ml-auto">

          <div *ngIf="candidate.risk_flag" class="risk-badge flex items-start gap-3 bg-[#fffbeb] border border-[#fde68a] rounded-lg p-3">
            <span class="text-xl leading-none">⚠️</span>
            <div class="flex flex-col">
              <span class="font-semibold text-[#b45309] text-sm leading-tight">Potential Risk</span>
            </div>
          </div>

          <button
            class="view-btn bg-[#2e1065] text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#1e1b4b] transition-colors flex items-center gap-2 whitespace-nowrap"
            style="font-family: inherit;"
            (click)="toggleExpand()">
            {{ isExpanded ? 'Hide Details' : 'View Details' }}
            <span class="text-xs transition-transform duration-200" [ngClass]="{'rotate-180': isExpanded}">▼</span>
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

  isExpanded: boolean = false;

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
}

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidateTileComponent } from '../candidate-tile/candidate-tile.component';
import { SkeletonLoaderComponent } from '../../../../shared/ui/skeleton-loader/skeleton-loader.component';
import { Candidate } from '../../../../core/models/candidate.model';

@Component({
  selector: 'app-candidate-list',
  standalone: true,
  imports: [CommonModule, CandidateTileComponent, SkeletonLoaderComponent],
  template: `
    <div class="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">

      <div *ngIf="!isProcessing && candidates.length === 0 && expectedCount === 0" class="col-span-full text-center text-gray-500 py-20 bg-white border-2 border-dashed border-gray-200 rounded-xl">
        Waiting for candidates to be uploaded...
      </div>

      <ng-container *ngFor="let candidate of sortedCandidates; let i = index; trackBy: trackById">
        <app-skeleton-loader *ngIf="candidate.executive_summary === 'Processing AI narrative...'"></app-skeleton-loader>

        <app-candidate-tile
          *ngIf="candidate.executive_summary !== 'Processing AI narrative...'"
          [candidate]="candidate"
          [rank]="i + 1"
          [autoExpand]="candidate.id === firstRiskCandidateId">
        </app-candidate-tile>
      </ng-container>

      <ng-container *ngFor="let skeleton of skeletonArray">
        <app-skeleton-loader></app-skeleton-loader>
      </ng-container>

    </div>
  `
})

/**
 * Component for displaying a list of candidate tiles.
 * @param candidates The array of candidate objects to display.
 */
export class CandidateListComponent {

  @Input() candidates: Candidate[] = [];
  @Input({ required: true }) isProcessing: boolean = false;
  @Input() expectedCount: number = 0;

  private lockedRiskCandidateId: string | null = null;

  /**
   * Sorts the candidates by their baseline score in descending order.
   * @returns An array of sorted candidates.
   */
  get sortedCandidates(): Candidate[] {
    if (!this.candidates) return [];

    return [...this.candidates].sort((a, b) => {
      const scoreA = a.user_score || 0;
      const scoreB = b.user_score || 0;
      return scoreB - scoreA;
    });
  }

  get firstRiskCandidateId(): string | null {
    // We have already locked in a target: stick with it
    if (this.lockedRiskCandidateId) {
      return this.lockedRiskCandidateId;
    }

    // Otherwise: look for the first valid risk candidate in the current list
    const firstRisk = this.sortedCandidates.find(c =>
      c.risk_flag && c.executive_summary !== 'Processing AI narrative...'
    );

    // If present, set it as the target
    if (firstRisk) {
      setTimeout(() => {
        this.lockedRiskCandidateId = firstRisk.id;
      });
      return firstRisk.id;
    }

    return null;
  }

  /**
   * Generates an array of skeletons for pending candidates.
   * @returns An array of skeletons.
   */
  get skeletonArray(): number[] {
    const remaining = this.expectedCount - this.candidates.length;
    return remaining > 0 ? Array(remaining).fill(0) : [];
  }

  /**
   * Tracks the candidate by its ID.
   * @param index Index of the candidate in the array.
   * @param candidate The candidate object to track.
   * @returns The ID of the candidate.
   */
  trackById(index: number, candidate: Candidate): string {
    return candidate.id;
  }
}

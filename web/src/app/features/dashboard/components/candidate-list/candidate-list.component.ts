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

      <div *ngIf="candidates.length === 0" class="col-span-full text-center text-gray-500 py-20 bg-white border-2 border-dashed border-gray-200 rounded-xl">
        Waiting for candidates to be uploaded...
      </div>

      <ng-container *ngFor="let candidate of sortedCandidates; let i = index; trackBy: trackById">

        <app-skeleton-loader *ngIf="!candidate.rf_score || candidate.rf_score === 0"></app-skeleton-loader>

        <app-candidate-tile
          *ngIf="candidate.rf_score && candidate.rf_score > 0"
          [candidate]="candidate"
          [rank]="i + 1">
        </app-candidate-tile>

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

  /**
   * Sorts the candidates by their RF score in descending order.
   * @returns An array of sorted candidates.
   */
  get sortedCandidates(): Candidate[] {
    if (!this.candidates) return [];

    return [...this.candidates].sort((a, b) => {
      const scoreA = a.rf_score || 0;
      const scoreB = b.rf_score || 0;
      return scoreB - scoreA;
    });
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

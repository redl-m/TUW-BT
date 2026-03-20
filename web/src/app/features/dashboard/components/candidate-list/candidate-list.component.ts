import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Candidate } from '../../../../core/models/candidate.model';
import { CandidateTileComponent } from '../candidate-tile/candidate-tile.component';
import { SkeletonLoaderComponent } from '../../../../shared/ui/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-candidate-list',
  standalone: true,
  imports: [CommonModule, CandidateTileComponent, SkeletonLoaderComponent],
  template: `
    <div class="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">

      <ng-container *ngIf="isProcessing">
        <app-skeleton-loader *ngFor="let dummy of [1,2,3,4,5,6]"></app-skeleton-loader>
      </ng-container>

      <ng-container *ngIf="!isProcessing">
        <div *ngIf="candidates.length === 0" class="col-span-full text-center text-gray-500 py-20 bg-white border-2 border-dashed border-gray-200 rounded-xl">
          Waiting for candidates to be uploaded...
        </div>

        <app-candidate-tile
          *ngFor="let candidate of candidates"
          [candidate]="candidate">
        </app-candidate-tile>
      </ng-container>

    </div>
  `
})

/**
 * Component for displaying a list of candidate tiles.
 * @param candidates The list of candidate objects to display.
 * @param isProcessing A flag indicating whether the component is in processing state.
 */
export class CandidateListComponent {
  @Input({ required: true }) candidates: Candidate[] = [];
  @Input({ required: true }) isProcessing: boolean = false;
}

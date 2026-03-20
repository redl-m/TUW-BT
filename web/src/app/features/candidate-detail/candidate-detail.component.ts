import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuestionListComponent } from './components/question-list/question-list.component';
import { ShapWaterfallComponent } from './components/shap-waterfall/shap-waterfall.component';
import { Candidate } from '../../core/models/candidate.model';

@Component({
  selector: 'app-candidate-detail',
  standalone: true,
  imports: [CommonModule, QuestionListComponent, ShapWaterfallComponent],
  styleUrls: ['./candidate-detail.component.scss'],
  template: `
    <div class="expanded-detail-container" *ngIf="candidate">

      <div class="detail-grid">
        <app-shap-waterfall
          [shapValues]="candidate.shap_values"
          [features]="candidate.features"
          class="grid-item">
        </app-shap-waterfall>

        <app-question-list
          [summary]="candidate.executive_summary"
          [questions]="candidate.interview_questions"
          class="grid-item">
        </app-question-list>
      </div>

    </div>
  `
})

/**
 * Component for displaying detailed information about a candidate.
 * @param candidate The candidate object containing the details.
 */
export class CandidateDetailComponent {
  @Input({ required: true }) candidate!: Candidate;
}

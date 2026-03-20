import {Component, Input, inject, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuestionListComponent } from './components/question-list/question-list.component';
import { ShapWaterfallComponent } from './components/shap-waterfall/shap-waterfall.component';
import { Candidate } from '../../core/models/candidate.model';
import { ApiService } from '../../core/services/api.service';

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
export class CandidateDetailComponent implements OnInit {
  @Input({ required: true }) candidate!: Candidate;
  apiService = inject(ApiService);

  ngOnInit() {
    const candidateId = this.candidate.id; // get ID directly from input

    if (this.candidate && (!this.candidate.executive_summary ||
      this.candidate.executive_summary === "Processing AI narrative...")) {
      this.apiService.prioritizeCandidate(candidateId).subscribe();
    }
  }
}

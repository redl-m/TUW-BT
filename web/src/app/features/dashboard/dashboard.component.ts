import {Component, inject, OnInit, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CandidateStore} from '../../core/state/candidate.store';
import {WeightingSidebarComponent} from './components/weighting-sidebar/weighting-sidebar.component';
import {CandidateListComponent} from './components/candidate-list/candidate-list.component';
import {ApiService} from '../../core/services/api.service';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, WeightingSidebarComponent, CandidateListComponent],
  styleUrls: ['./dashboard.component.scss'],
  template: `
    <div class="dashboard-layout">
      <div class="dashboard-container">

        <main class="main-content">
          <header class="dashboard-header">
            <h1>Candidate Ranking Dashboard</h1>
            <p>AI-assisted candidate evaluation with explainable insights</p>
          </header>

          <app-candidate-list
            [candidates]="store.candidates()"
            [isProcessing]="store.isProcessing()"
            [expectedCount]="store.expectedCandidateCount()">
          </app-candidate-list>
        </main>

        <aside class="sidebar-wrapper">
          <div class="sticky-sidebar">
            <app-weighting-sidebar></app-weighting-sidebar>
          </div>
        </aside>

      </div>
    </div>
  `
})

/**
 * Main dashboard component.
 */
export class DashboardComponent implements OnInit, OnDestroy {
  apiService = inject(ApiService);
  store = inject(CandidateStore);

  // Convert the Signal into an Observable
  jobWeights$ = toObservable(this.store.jobWeights);

  private destroy$ = new Subject<void>();
  isJobProcessed = false;
  initialWeightsLoaded = false;

  /**
   * Initializes the dashboard by setting up WebSocket listeners and subscribing to the job weights Signal.
   */
  ngOnInit() {
    // WebSocket Listener
    this.apiService.connectToCandidateUpdates((data) => {
      this.store.setCandidates(data.candidates);
      this.isJobProcessed = data.is_job_processed;

      // Anti-Snapback Lock
      if (!this.initialWeightsLoaded) {
        this.store.setJobWeights(data.job_weights);

        // Lock the frontend once the LLM finishes
        if (this.isJobProcessed) {
          this.initialWeightsLoaded = true;
        }
      }
    });

    // Listen to our new converted Observable
    this.jobWeights$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(200)
      )
      .subscribe(weights => {
        if (this.initialWeightsLoaded && weights && Object.keys(weights).length > 0) {
          this.apiService.updateWeights(weights).subscribe();
        }
      });
  }

  /**
   * Cleans up the component by completing the destroy$ Subject.
   */
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

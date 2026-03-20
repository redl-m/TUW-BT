import {Component, inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CandidateStore} from '../../core/state/candidate.store';
import {WeightingSidebarComponent} from './components/weighting-sidebar/weighting-sidebar.component';
import {CandidateListComponent} from './components/candidate-list/candidate-list.component';
import {ApiService} from '../../core/services/api.service';

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
            [isProcessing]="store.isProcessing()">
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
export class DashboardComponent implements OnInit {
  store = inject(CandidateStore);
  apiService = inject(ApiService);

  /**
   * Initializes the dashboard by subscribing to candidate updates.
   */
  ngOnInit() {
    this.apiService.connectToCandidateUpdates((candidates) => {
      this.store.setCandidates(candidates);
    });
  }
}

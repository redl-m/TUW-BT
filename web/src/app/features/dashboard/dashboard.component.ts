import {Component, inject, OnInit, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CandidateStore} from '../../core/state/candidate.store';
import {WeightingSidebarComponent} from './components/weighting-sidebar/weighting-sidebar.component';
import {CandidateListComponent} from './components/candidate-list/candidate-list.component';
import {ApiService} from '../../core/services/api.service';
import {Subject} from 'rxjs';
import {toObservable} from '@angular/core/rxjs-interop';

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
            <div class="header-title-area">
              <h1>Candidate Ranking Dashboard</h1>
              <p>AI-assisted candidate evaluation with explainable insights</p>
            </div>

            <div class="header-actions">
              <div class="status-tile" [ngClass]="isJobProcessed ? 'status-ready' : 'status-processing'">
                <span class="status-dot"></span>
                <span class="status-text">{{ isJobProcessed ? 'Job Description: Ready' : 'Job Description: Processing...' }}</span>
              </div>

              <button class="btn-manage" (click)="toggleUploadBox()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                  <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
                </svg>
                Manage Files
              </button>
            </div>
          </header>

          <div class="expandable-upload-box" *ngIf="showUploadBox">
            <div class="upload-box-header">
              <h3>Update Job Description & Candidate CVs</h3>
              <button class="btn-close" (click)="toggleUploadBox()">✕</button>
            </div>

            <div class="dropzone-container">
              <div class="dropzone card"
                   [class.drag-active]="isDraggingJob"
                   (dragover)="onDragOver($event, 'job')"
                   (dragleave)="onDragLeave($event, 'job')"
                   (drop)="onDrop($event, 'job')"
                   (click)="jobInput.click()">

                <input type="file" #jobInput hidden accept=".pdf,.doc,.docx,.txt" (change)="onFileSelected($event, 'job')">
                <div class="icon-wrapper blue">📄</div>

                <ng-container *ngIf="!jobFile">
                  <h4>Job Listing</h4>
                  <p>Drag & drop new job description<br>or click to browse</p>
                  <span class="file-types">PDF, DOC, DOCX, TXT</span>
                </ng-container>

                <ng-container *ngIf="jobFile">
                  <h4 class="success-text">Job Description Ready</h4>
                  <p class="font-semibold">{{ jobFile.name }}</p>
                  <span class="file-types">Processing update...</span>
                </ng-container>
              </div>

              <div class="dropzone card"
                   [class.drag-active]="isDraggingCv"
                   (dragover)="onDragOver($event, 'cv')"
                   (dragleave)="onDragLeave($event, 'cv')"
                   (drop)="onDrop($event, 'cv')"
                   (click)="cvInput.click()">

                <input type="file" #cvInput hidden multiple accept=".pdf,.doc,.docx" (change)="onFileSelected($event, 'cv')">
                <div class="icon-wrapper purple">👥</div>

                <ng-container *ngIf="cvFiles.length === 0">
                  <h4>Candidate CVs</h4>
                  <p>Drag & drop additional resumes<br>to add to evaluation</p>
                  <span class="file-types">Multiple files supported</span>
                </ng-container>

                <ng-container *ngIf="cvFiles.length > 0">
                  <h4 class="success-text">Uploaded {{ cvFiles.length }} Resumes</h4>
                  <p class="font-semibold text-sm">Processing candidates...</p>
                </ng-container>
              </div>
            </div>

            <div class="manage-candidates-section" *ngIf="store.candidates().length > 0">
              <div class="section-header">
                <h4>Current Candidates ({{ store.candidates().length }})</h4>
                <p>Remove candidates from the current evaluation pool</p>
              </div>

              <div class="candidate-chips-container">
                <div class="candidate-chip"
                     *ngFor="let candidate of store.candidates()"
                     [class.shimmer]="candidate.executive_summary === 'Processing AI narrative...'">

                  <span class="candidate-name">{{ formattedName(candidate.name) }}</span>

                  <button class="btn-delete-chip"
                          (click)="deleteCandidate(candidate.id)"
                          title="Remove {{ formattedName(candidate.name) }}"
                          [disabled]="candidate.executive_summary === 'Processing AI narrative...'">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

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
  initialWeightsLoaded = false;
  showUploadBox = false;

  // Upload State variables
  jobFile: File | null = null;
  cvFiles: File[] = [];
  isDraggingJob = false;
  isDraggingCv = false;

  /**
   * Initializes the dashboard by setting up WebSocket listeners and subscribing to the job weights Signal.
   */
  ngOnInit() {
    // WebSocket Listener
    this.apiService.connectToCandidateUpdates((data) => {
      this.store.setCandidates(data.candidates);

      // Anti-Snapback Lock: Only accept incoming weights if we haven't locked yet
      if (!this.initialWeightsLoaded) {
        this.store.setJobWeights(data.job_weights);

        // Lock the frontend once the backend signals the LLM has finished the job
        if (data.is_job_processed) {
          this.initialWeightsLoaded = true;
        }
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

  // Helper to check if a job has been processed based on the store's weights
  get isJobProcessed(): boolean {
    return this.initialWeightsLoaded;
  }

  /**
   * Toggles the visibility of the upload management box
   */
  toggleUploadBox() {
    this.showUploadBox = !this.showUploadBox;
  }

  /**
   *
   * @param event
   * @param type
   */
  onDragOver(event: DragEvent, type: 'job' | 'cv') {
    event.preventDefault();
    event.stopPropagation();
    if (type === 'job') this.isDraggingJob = true;
    if (type === 'cv') this.isDraggingCv = true;
  }

  onDragLeave(event: DragEvent, type: 'job' | 'cv') {
    event.preventDefault();
    event.stopPropagation();
    if (type === 'job') this.isDraggingJob = false;
    if (type === 'cv') this.isDraggingCv = false;
  }

  onDrop(event: DragEvent, type: 'job' | 'cv') {
    event.preventDefault();
    event.stopPropagation();

    if (type === 'job') this.isDraggingJob = false;
    if (type === 'cv') this.isDraggingCv = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFiles(files, type);
    }
  }

  onFileSelected(event: Event, type: 'job' | 'cv') {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFiles(input.files, type);
    }
  }

  /**
   * Processes the selected files and triggers the appropriate API call.
   * @param files Files to be uploaded
   * @param type 'job' for job description, 'cv' for candidate resumes
   * @private
   */
  private processFiles(files: FileList, type: 'job' | 'cv') {
    if (type === 'job') {
      this.jobFile = files[0];
      this.uploadNewJob(this.jobFile);
    } else {
      const fileArray = Array.from(files);
      this.cvFiles = [...this.cvFiles, ...fileArray];
      this.uploadAdditionalCvs(fileArray);
    }
  }

  uploadAdditionalCvs(files: File[]) {
    // Add to the existing expected count to show the correct number of skeleton loaders
    const newTotalCount = this.store.expectedCandidateCount() + files.length;
    this.store.setExpectedCandidateCount(newTotalCount);

    this.apiService.uploadCvs(files).subscribe({
      next: () => console.log(`Queued ${files.length} new candidates`),
      error: (err) => console.error('Upload failed:', err)
    });
  }

  uploadNewJob(file: File) {
    this.apiService.uploadJob(file).subscribe({
      next: () => {
        this.initialWeightsLoaded = false; // unlock weights listener for new slider weights
      },
      error: (err) => console.error('Job upload failed:', err)
    });
  }

  /**
   * Triggers the deletion of a candidate.
   * @param candidateId The ID of the candidate to delete.
   */
  deleteCandidate(candidateId: string) {
    this.apiService.deleteCandidate(candidateId).subscribe({
      next: () => {
        // Instantly remove the candidate from the local store so the UI updates
        this.store.removeCandidate(candidateId);

        // Decrement the expected count so a skeleton loader doesn't appear
        const currentExpectedCount = this.store.expectedCandidateCount();
        if (currentExpectedCount > 0) {
          this.store.setExpectedCandidateCount(currentExpectedCount - 1);
        }
      },
      error: (err) => console.error('Failed to delete candidate:', err)
    });
  }

  /**
   * Format the candidate's name to capitalize the first letter of each word.
   */
  formattedName(name: string | undefined): string {
    if (!name) return 'Unknown Candidate';
    return name
      .toLowerCase()
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

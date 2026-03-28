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

                <ng-container *ngIf="jobUiState === 'neutral'">
                  <h4>Job Listing</h4>
                  <p>Drag & drop new job description<br>or click to browse</p>
                  <span class="file-types">PDF, DOC, DOCX, TXT</span>
                </ng-container>

                <ng-container *ngIf="jobUiState === 'processing'">
                  <h4 class="text-blue-500">Processing Job...</h4>
                  <p class="font-semibold">{{ jobFile?.name }}</p>
                  <span class="file-types">Extracting baseline weights...</span>
                </ng-container>

                <ng-container *ngIf="jobUiState === 'success'">
                  <h4 class="success-text" *ngIf="!jobUploadStats?.rejected; else jobRejectedHeader">Job Description Processed</h4>
                  <ng-template #jobRejectedHeader>
                    <h4 class="text-orange-500">Upload Ignored</h4>
                  </ng-template>

                  <p class="font-semibold text-sm">
                    <span *ngIf="!jobUploadStats?.rejected" class="text-green-600">Successfully updated!</span>
                    <span *ngIf="jobUploadStats?.rejected" class="text-orange-500">This job description is already active.</span>
                  </p>
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

                <ng-container *ngIf="cvUiState === 'neutral'">
                  <h4>Candidate CVs</h4>
                  <p>Drag & drop additional resumes<br>to add to evaluation</p>
                  <span class="file-types">Multiple files supported</span>
                </ng-container>

                <ng-container *ngIf="cvUiState === 'processing'">
                  <h4 class="text-purple-500">Uploading Candidates...</h4>
                  <span class="file-types">Sending files to backend...</span>
                </ng-container>

                <ng-container *ngIf="cvUiState === 'success'">
                  <h4 class="success-text" *ngIf="cvUploadStats?.accepted; else allRejected">Upload Complete</h4>
                  <ng-template #allRejected>
                    <h4 class="text-orange-500">Upload Ignored</h4>
                  </ng-template>

                  <p class="font-semibold text-sm">
                    <span *ngIf="cvUploadStats?.accepted" class="text-green-600">{{ cvUploadStats?.accepted }} queued. </span>
                    <span *ngIf="cvUploadStats?.rejected" class="text-orange-500">{{ cvUploadStats?.rejected }} duplicates skipped.</span>
                  </p>
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

  // UI Display States
  jobUiState: 'neutral' | 'processing' | 'success' = 'neutral';
  cvUiState: 'neutral' | 'processing' | 'success' = 'neutral';
  cvUploadStats: { accepted: number; rejected: number } | null = null;
  jobUploadStats: { rejected: boolean } | null = null;

  // Timeout references to prevent memory leaks if closed early
  private jobSuccessTimeout: any;
  private cvSuccessTimeout: any;

  /**
   * Initializes the dashboard by setting up WebSocket listeners and subscribing to the job weights Signal.
   */
  ngOnInit() {
    this.apiService.connectToCandidateUpdates((data) => {
      this.store.setCandidates(data.candidates);

      if (!this.initialWeightsLoaded) {
        this.store.setJobWeights(data.job_weights);

        if (data.is_job_processed) {
          this.initialWeightsLoaded = true;

          // Switch to success, then reset to neutral after 3 seconds
          if (this.jobUiState === 'processing') {
            this.jobUiState = 'success';
            this.jobSuccessTimeout = setTimeout(() => this.resetJobUi(), 3000);
          }
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
    // Auto-reset the UI to neutral if the box is closed while looking at a success message
    if (!this.showUploadBox) {
      if (this.jobUiState === 'success') this.resetJobUi();
      if (this.cvUiState === 'success') this.resetCvUi();
    }
  }

  resetJobUi() {
    this.jobUiState = 'neutral';
    this.jobFile = null;
    this.jobUploadStats = null;
    clearTimeout(this.jobSuccessTimeout);
  }

  resetCvUi() {
    this.cvUiState = 'neutral';
    this.cvUploadStats = null;
    clearTimeout(this.cvSuccessTimeout);
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
        // DO NOT append to this.cvFiles here! Let uploadAdditionalCvs handle it.
        this.uploadAdditionalCvs(fileArray);
      }
    }

  uploadAdditionalCvs(files: File[]) {
    // Get lowercase active names
    const activeNames = this.store.candidates().map(c => c.name.toLowerCase());

    // Get original filenames from the store
    const storeFilenames = this.store.candidates()
      .map(c => c.original_filename?.toLowerCase())
      .filter(name => name); // filter out undefined

    // Get filenames uploaded  in this current session
    const sessionFilenames = this.cvFiles.map(f => f.name.toLowerCase());

    // Combine them into an absolute master list of filenames
    const allKnownFilenames = [...storeFilenames, ...sessionFilenames];

    // Filter out any files that match an existing candidate's name or a previously uploaded file
    const newUniqueFiles = files.filter(file => {
      const exactFileName = file.name.toLowerCase();

      // Exact filename match in store and local session
      if (allKnownFilenames.includes(exactFileName)) {
        return false; // Reject: This file is already uploaded
      }

      // Word Overlap Match
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const normalizedFileName = baseName.replace(/[_-]/g, ' ').toLowerCase();
      const fileWords = normalizedFileName.split(' ');

      const isDuplicateName = activeNames.some(activeName => {
        const activeWords = activeName.split(' ');
        if (activeWords.length === 0 || activeName.trim() === '') return false;

        return activeWords.every(word => fileWords.includes(word));
      });

      return !isDuplicateName; // Keep only if it passes both checks
    });

    // UI status update
    const rejectedCount = files.length - newUniqueFiles.length;
    this.cvUploadStats = { accepted: newUniqueFiles.length, rejected: rejectedCount };

    // Abort if all uploaded files were duplicates
    if (newUniqueFiles.length === 0) {
      this.cvUiState = 'success';
      this.cvSuccessTimeout = setTimeout(() => this.resetCvUi(), 5000);
      return;
    }

    // UI status update
    this.cvUiState = 'processing';

    // Update the local file tracking array with the unique files
    this.cvFiles = [...this.cvFiles, ...newUniqueFiles];

    // Add to the existing expected count to show the correct number of skeleton loaders
    const newTotalCount = this.store.expectedCandidateCount() + newUniqueFiles.length;
    this.store.setExpectedCandidateCount(newTotalCount);

    // Send only the unique files to the backend
    this.apiService.uploadCvs(newUniqueFiles).subscribe({
      next: () => {
        this.cvUiState = 'success';
        this.cvSuccessTimeout = setTimeout(() => this.resetCvUi(), 5000);
      },
      error: (err) => {
        console.error('Upload failed:', err);
        this.resetCvUi();
      }
    });
  }

  uploadNewJob(file: File) {
    this.jobUploadStats = { rejected: false };
    this.jobUiState = 'processing';

    this.apiService.uploadJob(file).subscribe({
      next: () => {
        // Unlock the frontend to listen for new job weights
        this.initialWeightsLoaded = false;
      },
      error: (err) => {
        // Catch the HTTP 409 Conflict from the backend
        if (err.status === 409) {
          this.jobUploadStats = { rejected: true };
          this.jobUiState = 'success';
          this.jobSuccessTimeout = setTimeout(() => this.resetJobUi(), 4000);
        } else {
          console.error('Job upload failed:', err);
          this.resetJobUi();
        }
      }
    });
  }

  /**
   * Triggers the deletion of a candidate.
   * @param candidateId The ID of the candidate to delete.
   */
  deleteCandidate(candidateId: string) {
    // Find the candidate first to determine the file to be removed
    const candidateToDelete = this.store.candidates().find(c => c.id === candidateId);

    this.apiService.deleteCandidate(candidateId).subscribe({
      next: () => {
        // Instantly remove the candidate from the local store so the UI updates
        this.store.removeCandidate(candidateId);

        // Decrement the expected count so a skeleton loader doesn't appear
        const currentExpectedCount = this.store.expectedCandidateCount();
        if (currentExpectedCount > 0) {
          this.store.setExpectedCandidateCount(currentExpectedCount - 1);
        }

        // Remove the deleted candidate's file from the local array
        if (candidateToDelete) {
          const normalizedDeleteName = candidateToDelete.name.toLowerCase();

          this.cvFiles = this.cvFiles.filter(file => {
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const normalizedFileName = baseName.replace(/[_-]/g, ' ').toLowerCase();
            const fileWords = normalizedFileName.split(' ');
            const deleteWords = normalizedDeleteName.split(' ');

            // This is the file to be filtered out if there is a match
            const isMatch = deleteWords.every(word => fileWords.includes(word));
            return !isMatch; // Keep the file only if it doesn't match the deleted candidate
          });
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

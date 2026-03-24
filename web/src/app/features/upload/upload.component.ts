import {Component, inject, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CandidateStore } from '../../core/state/candidate.store';
import { ApiService } from '../../core/services/api.service';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./upload.component.scss'],
  template: `
    <div class="upload-layout">

      <button class="settings-toggle-btn"
              (click)="toggleSettings()"
              [ngClass]="llmSettings.provider === 'api' ?
                 (systemStatus.api === 'ready' ? 'status-ready' : 'status-warning') :
                 (systemStatus.local === 'ready' ? 'status-ready' : 'status-loading')">
        <span class="dot"></span>
        <span class="pill-text">{{ getShortStatusText() }}</span>
        <span class="icon">⚙️</span>
      </button>

      <div class="header-text">
        <h1>AI Candidate Ranking System</h1>
        <p>Drop your job listing and candidate CVs to automatically begin evaluation</p>
      </div>

      <div class="settings-card card" *ngIf="isSettingsOpen">
        <div class="settings-header">
          <h3>Engine Configuration</h3>
          <button class="btn-close" (click)="toggleSettings()">✕ Close</button>
        </div>

        <div class="toggle-group mt-3" [class.disabled-group]="isEjecting">
          <button [class.active]="llmSettings.provider === 'api'"
                  [disabled]="isEjecting"
                  (click)="setProvider('api')">Open WebUI API</button>
          <button [class.active]="llmSettings.provider === 'local'"
                  [disabled]="isEjecting"
                  (click)="setProvider('local')">Local Model</button>
        </div>

        <div class="api-settings-form mt-4" *ngIf="llmSettings.provider === 'api'">
          <div class="form-group">
            <label>API Endpoint Base URL</label>
            <input type="text" [(ngModel)]="llmSettings.base_url" (blur)="saveSettings()">
          </div>
          <div class="form-group">
            <label>API Key (Bearer)</label>
            <input type="password" placeholder="sk-..." [(ngModel)]="llmSettings.api_key" (blur)="saveSettings()">
          </div>
          <div class="form-group">
            <label>Model Identifier</label>
            <input type="text" [(ngModel)]="llmSettings.model_name" (blur)="saveSettings()">
          </div>
        </div>

        <div class="eject-wrapper mt-4" *ngIf="systemStatus.local === 'ready' || systemStatus.local === 'loading'">
          <div class="eject-info">
            <span class="icon">💾</span>
            <div>
              <p class="eject-title">Local Model resides in VRAM</p>
              <p class="eject-desc">Free up your GPU memory if you switched to the API.</p>
            </div>
          </div>
          <button class="btn-eject" (click)="ejectLocalModel()">⏏️ Eject Model</button>
        </div>
      </div>

      <div class="dropzone-container" *ngIf="!isSettingsOpen">
        <div class="dropzone card"
             [class.drag-active]="isDraggingJob"
             (dragover)="onDragOver($event, 'job')"
             (dragleave)="onDragLeave($event, 'job')"
             (drop)="onDrop($event, 'job')"
             (click)="jobInput.click()">

          <input type="file" #jobInput hidden accept=".pdf,.doc,.docx,.txt" (change)="onFileSelected($event, 'job')">
          <div class="icon-wrapper blue">📄</div>

          <ng-container *ngIf="!jobFile">
            <h3>Job Listing</h3>
            <p>Drag & drop your job description here<br>or click to browse files</p>
            <span class="file-types">PDF, DOC, DOCX, TXT</span>
          </ng-container>

          <ng-container *ngIf="jobFile">
            <h3 class="success-text">Job Description Ready</h3>
            <p class="font-semibold">{{ jobFile.name }}</p>
            <span class="file-types">Processing in background...</span>
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
            <h3>Candidate CVs</h3>
            <p>Drag & drop candidate resumes here<br>to launch the dashboard</p>
            <span class="file-types">Multiple files supported</span>
          </ng-container>

          <ng-container *ngIf="cvFiles.length > 0">
            <h3 class="success-text">Uploading {{ cvFiles.length }} Resumes...</h3>
            <p class="font-semibold text-sm">Redirecting to dashboard...</p>
          </ng-container>
        </div>
      </div>
    </div>
  `
})
export class UploadComponent implements OnInit {
  router = inject(Router);
  store = inject(CandidateStore);
  apiService = inject(ApiService);

  // Upload State
  jobFile: File | null = null;
  cvFiles: File[] = [];
  isDraggingJob = false;
  isDraggingCv = false;

  // Settings State
  isSettingsOpen = false;
  isEjecting = false;
  llmSettings = {
    provider: 'api',
    api_key: '',
    base_url: 'https://aqueduct.ai.datalab.tuwien.ac.at/v1',
    model_name: 'qwen-coder-30b'
  };

  systemStatus = {
    local: 'loading',
    api: 'missing_key'
  };

  ngOnInit() {
    this.fetchSettings();
  }

  toggleSettings() {
    this.isSettingsOpen = !this.isSettingsOpen;
  }

  fetchSettings() {
    this.apiService.getLlmStatus().subscribe(res => {
      if (res) {
        this.llmSettings = res.settings;
        this.systemStatus = res.status;
      }
    });
  }

  setProvider(provider: 'api' | 'local') {
    this.llmSettings.provider = provider;
    this.saveSettings();
  }

  saveSettings() {
    this.apiService.updateLlmSettings(this.llmSettings).subscribe(() => {
      // Re-fetch status to update UI chips
      this.fetchSettings();
    });
  }

  ejectLocalModel() {
    this.isEjecting = true;
    this.systemStatus.local = 'unloading'; // Immediate visual feedback

    this.apiService.unloadLocalModel().subscribe({
      next: () => {
        // Add a slight delay to give the OS time to reclaim the VRAM
        setTimeout(() => {
          this.isEjecting = false;
          this.fetchSettings();
        }, 1500);
      },
      error: (err) => {
        console.error("Failed to eject model", err);
        this.isEjecting = false;
        this.fetchSettings();
      }
    });
  }

  checkEngineReady(): boolean {
    const isReady = this.llmSettings.provider === 'api'
      ? this.systemStatus.api === 'ready'
      : this.systemStatus.local === 'ready';

    if (!isReady) {
      alert("The selected AI Engine is not ready. Please configure your settings or wait for the model to load before uploading.");
      this.isSettingsOpen = true; // Automatically pop open the settings
      return false;
    }
    return true;
  }

  getShortStatusText() {
    if (this.llmSettings.provider === 'api') {
      return this.systemStatus.api === 'ready' ? 'API Ready' : 'API Setup Req.';
    } else {
      return this.systemStatus.local === 'ready' ? 'Local Ready' : 'Local Loading...';
    }
  }

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

    // Reject the drop if the engine is not ready
    if (!this.checkEngineReady()) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFiles(files, type);
    }
  }

  onFileSelected(event: Event, type: 'job' | 'cv') {
    const input = event.target as HTMLInputElement;

    // Reject the click selection if the engine is not ready
    if (!this.checkEngineReady()) {
      input.value = '';
      return;
    }

    if (input.files && input.files.length > 0) {
      this.processFiles(input.files, type);
    }
  }

  private processFiles(files: FileList, type: 'job' | 'cv') {
    if (type === 'job') {
      this.jobFile = files[0];
      this.apiService.uploadJob(this.jobFile).subscribe();
    } else {
      this.cvFiles = [...this.cvFiles, ...Array.from(files)];
      this.apiService.uploadCvs(this.cvFiles).subscribe();
      this.store.setExpectedCandidateCount(this.cvFiles.length);
    }

    // Check if both job and CV files are uploaded
    if (this.jobFile && this.cvFiles.length > 0) {
      this.router.navigate(['/dashboard']);
    }
  }
}

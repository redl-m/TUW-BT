import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CandidateStore } from '../../core/state/candidate.store';
import { ApiService } from '../../core/services/api.service';
import { FormsModule } from '@angular/forms';

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
                  (click)="setProvider('api')">TU Wien dataLAB API</button>
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

        <div class="local-settings-form mt-4" *ngIf="llmSettings.provider === 'local'">
          <div class="form-group">
            <label>HuggingFace Model Path or Hub ID</label>
            <input type="text" placeholder="e.g. meta-llama/Meta-Llama-3.1-8B-Instruct"
                   [(ngModel)]="llmSettings.local_model_id"
                   (blur)="saveSettings()">

            <div class="mt-2" *ngIf="systemStatus.local === 'unloaded' || systemStatus.local === 'loading'">
              <button *ngIf="systemStatus.local === 'unloaded'"
                      class="btn-load"
                      (click)="loadLocalModel()">
                Load Local Model
              </button>

              <div *ngIf="systemStatus.local === 'loading'" class="load-progress-bar">
                <div class="load-progress-fill" [style.width.%]="getLoadPercentage()"></div>
                <span class="load-progress-text">
                        {{ getLoadPercentage() > 0 ? 'Loading Weights... ' + getLoadPercentage() + '%' : 'Allocating Memory...' }}
                    </span>
              </div>
            </div>
          </div>

          <div class="hardware-monitor mt-4">
            <div class="monitor-header">
              <div>
                <h4 class="monitor-title">Dedicated GPU Memory</h4>
                <span class="monitor-subtitle">VRAM Allocation</span>
              </div>
              <div class="monitor-stats">
                <span class="stat-value">{{ currentVram.used_gb | number:'1.1-1' }} GB</span>
                <span class="stat-total">/ {{ currentVram.total_gb | number:'1.1-1' }} GB</span>
              </div>
            </div>

            <div class="chart-container">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none">
                <line x1="0" y1="25" x2="300" y2="25" class="grid-line" />
                <line x1="0" y1="50" x2="300" y2="50" class="grid-line" />
                <line x1="0" y1="75" x2="300" y2="75" class="grid-line" />
                <path [attr.d]="getSvgArea()" class="chart-area" />
                <path [attr.d]="getSvgPath()" class="chart-line" />
              </svg>
            </div>

            <div class="terminal-output" *ngIf="systemStatus.local === 'loading' && currentVram.progress_str">
              <code>> {{ currentVram.progress_str }}</code>
            </div>
          </div>
        </div>

        <div class="eject-wrapper mt-4" *ngIf="systemStatus.local === 'ready' || systemStatus.local === 'loading' || isEjecting">
          <div class="eject-info">
            <span class="icon">💾</span>
            <div>
              <p class="eject-title">Local Model resides in VRAM</p>
              <p class="eject-desc">Free up your GPU memory if you switched to the API.</p>
            </div>
          </div>
          <button class="btn-eject" (click)="ejectLocalModel()" [disabled]="isEjecting || systemStatus.local === 'loading'">
            {{ isEjecting ? '⏳ Ejecting...' : '⏏️ Eject Model' }}
          </button>
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
export class UploadComponent implements OnInit, OnDestroy {
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
    model_name: 'qwen-coder-30b',
    local_model_id: ''
  };

  systemStatus = {
    local: 'loading',
    api: 'missing_key'
  };

  // Hardware Monitor State
  statsInterval: any;
  vramHistory: number[] = Array(50).fill(0);
  currentVram = { used_gb: 0, total_gb: 0, percent: 0, progress_str: '' };

  ngOnInit() {
    this.fetchSettings();
  }

  ngOnDestroy() {
    this.stopStatsPolling();
  }

  toggleSettings() {
    this.isSettingsOpen = !this.isSettingsOpen;
    if (this.isSettingsOpen) {
      this.startStatsPolling();
    } else {
      this.stopStatsPolling();
    }
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

  loadLocalModel() {
    this.systemStatus.local = 'loading'; // Immediate visual feedback
    this.currentVram.progress_str = 'Initializing Hugging Face...';

    this.apiService.loadLocalModel().subscribe({
      next: () => {
        // polling interval will detect status changes automatically
      },
      error: (err) => {
        console.error("Failed to load model", err);
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

  startStatsPolling() {
    this.pollStats();
    this.statsInterval = setInterval(() => this.pollStats(), 1000);
  }

  stopStatsPolling() {
    if (this.statsInterval) clearInterval(this.statsInterval);
  }

  pollStats() {
    this.apiService.getLlmStats().subscribe(stats => {
      this.currentVram = stats;
      this.vramHistory.shift();
      this.vramHistory.push(stats.percent);

      // Sync the system status in real-time so the Eject button enables automatically
      if (stats.local_status) {
        this.systemStatus.local = stats.local_status;
      }
    });
  }

  getLoadPercentage(): number {
    if (!this.currentVram.progress_str) return 0;
    const match = this.currentVram.progress_str.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  }

  getSvgPath(): string {
    const width = 300;
    const height = 100;
    const points = this.vramHistory.map((val, index) => {
      const x = (index / (this.vramHistory.length - 1)) * width;
      const y = height - (val / 100) * height;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }

  getSvgArea(): string {
    const path = this.getSvgPath();
    return `${path} L 300,100 L 0,100 Z`;
  }
}

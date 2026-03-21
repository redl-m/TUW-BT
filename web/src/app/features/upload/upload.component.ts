import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CandidateStore } from '../../core/state/candidate.store';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./upload.component.scss'],
  template: `
    <div class="upload-layout">
      <div class="header-text">
        <h1>AI Candidate Ranking System</h1>
        <p>Drop your job listing and candidate CVs to automatically begin evaluation</p>
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
export class UploadComponent {
  router = inject(Router);
  store = inject(CandidateStore);
  apiService = inject(ApiService);

  jobFile: File | null = null;
  cvFiles: File[] = [];

  isDraggingJob = false;
  isDraggingCv = false;

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

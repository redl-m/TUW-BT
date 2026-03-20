import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-question-list',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./question-list.component.scss'],
  template: `
    <div class="question-list-wrapper">

      <div class="custom-card">
        <h3 class="card-title">Follow-up Questions</h3>

        <div *ngIf="!questions?.length" class="empty-state">
          Awaiting ContextualSHAP generation...
        </div>

        <div class="questions-container">
          <div *ngFor="let q of questions; let i = index" class="question-bubble group">
            <p class="question-text">{{ q }}</p>

            <button
              class="icon-copy-btn"
              (click)="copySingle(q, i)"
              title="Copy to clipboard">

              <svg *ngIf="copiedIndex !== i" class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <svg *ngIf="copiedIndex === i" class="icon text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </button>
          </div>
        </div>

        <button class="copy-btn" (click)="copyAll()">
          <svg *ngIf="!copiedAll" class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          <svg *ngIf="copiedAll" class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          {{ copiedAll ? 'Copied to Clipboard!' : 'Copy All Questions' }}
        </button>
      </div>

      <div class="custom-card">
        <h3 class="card-title">Executive Summary</h3>
        <p class="summary-text">{{ summary || 'Generating narrative...' }}</p>
      </div>

    </div>
  `
})
export class QuestionListComponent {
  @Input() summary: string | undefined = '';
  @Input() questions: string[] | undefined = [];

  copiedIndex: number | null = null;
  copiedAll: boolean = false;


  /**
   * Copies a single question to the clipboard.
   * @param text The question text to copy.
   * @param index The index of the question in the list.
   */
  async copySingle(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedIndex = index;
      setTimeout(() => this.copiedIndex = null, 2000); // Reset after 2s
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }


  /**
   * Copies all questions to the clipboard in a single string.
   */
  async copyAll() {
    if (!this.questions || this.questions.length === 0) return;

    // Joins questions with double line breaks for readability
    const fullText = this.questions.join('\n\n');
    try {
      await navigator.clipboard.writeText(fullText);
      this.copiedAll = true;
      setTimeout(() => this.copiedAll = false, 2000); // Reset after 2s
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }
}

import { Component } from '@angular/core';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  template: `
    <div class="skeleton-card-wrapper">
      <div class="skeleton-card">

        <div class="identity-section">
          <div class="shimmer skeleton-avatar"></div>
          <div class="info">
            <div class="shimmer skeleton-badge"></div>
            <div class="shimmer skeleton-name"></div>
          </div>
        </div>

        <div class="scores-section">
          <div class="score-row">
            <div class="shimmer skeleton-label"></div>
            <div class="shimmer skeleton-track"></div>
            <div class="shimmer skeleton-value"></div>
          </div>
          <div class="score-row">
            <div class="shimmer skeleton-label"></div>
            <div class="shimmer skeleton-track"></div>
            <div class="shimmer skeleton-value"></div>
          </div>
        </div>

        <div class="action-section">
          <div class="shimmer skeleton-btn"></div>
        </div>

      </div>
    </div>
  `,
  styleUrls: ['./skeleton-loader.component.scss']
})
export class SkeletonLoaderComponent {}

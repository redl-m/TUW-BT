import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-shap-waterfall',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./shap-waterfall.component.scss'],
  template: `
    <div class="shap-card">
      <h3 class="shap-title">Explainable AI - Feature Impact</h3>

      <div *ngIf="!shapValues" class="loading-state">
        Calculating attributions...
      </div>

      <div *ngIf="shapValues && formattedShapData.length === 0" class="text-sm text-gray-500 italic mt-4">
        No significantly impactful features (>0.5%) found.
      </div>

      <div *ngIf="shapValues && formattedShapData.length > 0" class="chart-container">
        <div *ngFor="let item of formattedShapData" class="data-row">

          <div class="text-row">
            <span class="feature-label" [title]="item.displayLabel">{{ item.displayLabel }}</span>
            <span class="feature-value" [ngClass]="item.value > 0 ? 'text-green' : 'text-red'">
               {{ item.value > 0 ? '+' : '' }}{{ item.value | percent:'1.0-0' }}
             </span>
          </div>

          <div class="bar-track">
            <div class="center-axis"></div>
            <div *ngIf="item.value > 0" class="bar bar-positive" [style.width.%]="item.normalized * 50"></div>
            <div *ngIf="item.value < 0" class="bar bar-negative" [style.width.%]="item.normalized * 50"></div>
          </div>

        </div>
      </div>

      <div class="legend-container">
        <div class="legend-item"><div class="legend-swatch bg-red"></div><span>Negative Impact</span></div>
        <div class="legend-item"><div class="legend-swatch bg-green"></div><span>Positive Impact</span></div>
      </div>
    </div>
  `
})
export class ShapWaterfallComponent {
  @Input() shapValues: Record<string, number> | null | undefined = null;
  @Input() features: Record<string, any> | undefined = {};

  get formattedShapData() {
    if (!this.shapValues) return [];

    const entries = Object.entries(this.shapValues);

    // Calculate total absolute impact to turn raw log-odds into true percentages
    const totalAbsoluteImpact = entries.reduce((sum, [_, val]) => sum + Math.abs(val), 0);

    if (totalAbsoluteImpact === 0) return [];

    // Map to true percentages and preserve your display label logic
    let items = entries.map(([feature, rawValue]) => {
      // Create decimal percentage between -1.0 and 1.0
      const truePercentage = rawValue / totalAbsoluteImpact;
      const absPercentage = Math.abs(truePercentage);

      // Look up feature value
      let displayLabel = feature;
      if (this.features && this.features[feature] !== undefined && this.features[feature] !== '') {
        const featureValue = this.features[feature];
        const valueStr = Array.isArray(featureValue) ? featureValue.join(', ') : featureValue;
        displayLabel = `${feature}: ${valueStr}`;
      }

      return {
        feature,
        displayLabel,
        value: truePercentage,
        absPercentage: absPercentage
      };
    });

    // Keep items with greater than 0.5% impact
    items = items.filter(item => item.absPercentage > 0.005);

    // Sort items by absolute value in descending order
    items.sort((a, b) => b.absPercentage - a.absPercentage);

    // Limit to the top 7 contributions
    items = items.slice(0, 7);

    // Scale the bars visually relative to the largest visible item so the UI looks balanced
    const maxVisibleAbs = items.length > 0 ? items[0].absPercentage : 1;

    return items.map(item => ({
      ...item,
      normalized: maxVisibleAbs > 0 ? item.absPercentage / maxVisibleAbs : 0 // ensures largest bar is always 50%
    }));
  }
}

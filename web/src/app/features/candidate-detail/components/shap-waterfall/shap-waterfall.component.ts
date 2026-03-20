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

      <div *ngIf="shapValues" class="chart-container">
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

/**
 * Component for displaying SHAP waterfall chart.
 * @param shapValues The SHAP values to display.
 * @param features The features used to generate the SHAP values.
 */
export class ShapWaterfallComponent {
  @Input() shapValues: Record<string, number> | null | undefined = null;
  @Input() features: Record<string, any> | undefined = {}; // <--- New Input

  /**
   * Formats the SHAP values into a more readable format.
   * @returns An array of objects with feature name, value, and normalized value.
   */
  get formattedShapData() {
    if (!this.shapValues) return [];

    let maxAbs = 0;
    const items = Object.entries(this.shapValues).map(([feature, value]) => {
      if (Math.abs(value) > maxAbs) maxAbs = Math.abs(value);

      // Look up the feature value: Append it if it exists, otherwise use the feature name
      let displayLabel = feature;
      if (this.features && this.features[feature] !== undefined && this.features[feature] !== '') {

        const featureValue = this.features[feature];
        const valueStr = Array.isArray(featureValue) ? featureValue.join(', ') : featureValue; // handle arrays
        displayLabel = `${feature}: ${valueStr}`;
      }

      return { feature, displayLabel, value };
    });

    // Sort items by absolute value in descending order
    items.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    return items.map(item => ({
      ...item,
      normalized: maxAbs > 0 ? Math.abs(item.value) / maxAbs : 0
    }));
  }
}

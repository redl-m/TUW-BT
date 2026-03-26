import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const FEATURE_NAME_MAP: Record<string, string> = {
  'years_of_experience': 'Years of Experience',
  'education_level': 'Education Level',
  'job_hopping': 'Job Hopping History',
  'structural_adherence': 'Structural Adherence',
  'adaptive_fluidity': 'Adaptive Fluidity',
  'interpersonal_influence': 'Interpersonal Influence',
  'execution_velocity': 'Execution Velocity',
  'psychological_resilience': 'Psychological Resilience'
};

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

    // Map directly from the SHAP values using the dictionary
    let items = entries.map(([featureKey, rawValue]) => {

      const friendlyName = FEATURE_NAME_MAP[featureKey] || featureKey;

      // Extract the candidate's data value for this trait
      let featureValueStr = '';
      if (this.features && this.features[featureKey] !== undefined) {
        featureValueStr = String(this.features[featureKey]);
      }

      // Combine them into a clean label: "Education Level: MBA"
      const displayLabel = featureValueStr ? `${friendlyName}: ${featureValueStr}` : friendlyName;

      return {
        feature: featureKey,
        displayLabel: displayLabel,
        value: rawValue, // handled by backend
        absPercentage: Math.abs(rawValue)
      };
    });

    // Apply Filters
    items = items.filter(item => item.absPercentage > 0.005); // only features > 0.5% impact
    items.sort((a, b) => b.absPercentage - a.absPercentage); // sort
    items = items.slice(0, 7); // limit to top 7
    const maxVisibleAbs = items.length > 0 ? items[0].absPercentage : 1; // bar scaling

    return items.map(item => ({
      ...item,
      normalized: maxVisibleAbs > 0 ? (item.absPercentage / maxVisibleAbs) : 0
    }));
  }
}

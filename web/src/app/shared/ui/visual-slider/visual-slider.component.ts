import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-visual-slider',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./visual-slider.component.scss'],
  template: `
    <div class="slider-wrapper">

      <div class="slider-header">
        <span class="label">{{ label }}</span>
        <span class="impact-badge">{{ impactPercentage }}% impact</span>
      </div>

      <div class="description">{{ description }}</div>

      <div class="track-container">
        <div class="track-background"></div>

        <input
          type="range"
          [id]="id"
          min="1"
          max="5"
          step="1"
          [value]="value"
          (input)="onInput($event)"
          class="native-slider"
        >

        <div class="custom-thumb" [style.left.%]="fillPercentage"></div>
      </div>

      <div class="tick-labels">
        <span [class.active]="value <= 2">Ignore</span>
        <span [class.active]="value === 3">Important</span>
        <span [class.active]="value >= 4">Critical</span>
      </div>

    </div>
  `
})

/**
 * Component for displaying a visual slider with a label, description, and impact percentage.
 * @param label The label for the slider.
 * @param description The description for the slider.
 * @param value The current value of the slider.
 * @param impactPercentage The impact percentage of the slider.
 * @param id The unique identifier for the slider.
 */
export class VisualSliderComponent {
  @Input({ required: true }) label!: string;
  @Input() description: string = '';
  @Input({ required: true }) value: number = 3;
  @Input() impactPercentage: number = 0;
  @Input() id: string = Math.random().toString(36).substring(2, 9);

  @Output() valueChange = new EventEmitter<number>();

  // Maps the 1-5 scale to a 0-100% position
  get fillPercentage(): number {
    return ((this.value - 1) / 4) * 100;
  }

  onInput(event: Event) {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.value = val;
    this.valueChange.emit(this.value);
  }
}

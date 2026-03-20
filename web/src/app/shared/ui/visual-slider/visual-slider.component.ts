import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-visual-slider',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./visual-slider.component.scss'],
  template: `
    <div class="slider-wrapper" [class.is-disabled]="disabled">

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
          [disabled]="disabled"
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
 */
export class VisualSliderComponent {
  @Input({ required: true }) label!: string;
  @Input() description: string = '';
  @Input({ required: true }) value: number = 3;
  @Input() impactPercentage: number = 0;
  @Input() id: string = Math.random().toString(36).substring(2, 9);

  // The disabled input flag to receive the lock state from the sidebar
  @Input() disabled: boolean = false;

  @Output() valueChange = new EventEmitter<number>();

  // Maps the 1-5 scale to a 0-100% position
  get fillPercentage(): number {
    return ((this.value - 1) / 4) * 100;
  }

  /**
   * Handles the input event from the slider.
   * @param event The input event object.
   */
  onInput(event: Event) {
    // Safety guard to completely block emissions if the slider is locked
    if (this.disabled) return;

    this.value = parseInt((event.target as HTMLInputElement).value, 10);
    this.valueChange.emit(this.value);
  }
}

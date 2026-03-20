import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden animate-pulse">

      <div class="flex items-center gap-4 mb-6">
        <div class="w-14 h-14 bg-gray-200 rounded-full shrink-0"></div>
        <div class="space-y-2 flex-1">
          <div class="h-5 bg-gray-200 rounded w-2/3"></div>
          <div class="h-3 bg-gray-100 rounded w-1/3"></div>
        </div>
      </div>

      <div class="space-y-4 mb-6">
        <div>
          <div class="flex justify-between mb-2">
            <div class="h-3 bg-gray-200 rounded w-1/4"></div>
            <div class="h-3 bg-gray-200 rounded w-1/12"></div>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2.5"></div>
        </div>
        <div>
          <div class="flex justify-between mb-2">
            <div class="h-3 bg-gray-100 rounded w-1/4"></div>
            <div class="h-3 bg-gray-100 rounded w-1/12"></div>
          </div>
          <div class="w-full bg-gray-50 rounded-full h-2"></div>
        </div>
      </div>

      <div class="w-full h-9 bg-gray-100 rounded-lg"></div>

    </div>
  `
})

// TODO: Implement and connect to backend
export class SkeletonLoaderComponent {}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between gap-6 w-full animate-pulse">

      <div class="flex items-center gap-4 min-w-[200px]">
        <div class="w-12 h-12 bg-gray-200 rounded-full"></div> <div class="flex flex-col gap-2 justify-center">
        <div class="w-10 h-4 bg-gray-200 rounded-md"></div> <div class="w-32 h-5 bg-gray-200 rounded-md"></div> </div>
      </div>

      <div class="flex-grow max-w-xl flex flex-col gap-4">
        <div class="flex items-center gap-4">
          <div class="w-24 h-4 bg-gray-200 rounded-md"></div> <div class="flex-grow bg-gray-100 rounded-full h-3"></div> <div class="w-8 h-4 bg-gray-200 rounded-md"></div> </div>

        <div class="flex items-center gap-4">
          <div class="w-24 h-4 bg-gray-200 rounded-md"></div> <div class="flex-grow bg-gray-100 rounded-full h-3"></div> <div class="w-8 h-4 bg-gray-200 rounded-md"></div> </div>
      </div>

      <div class="flex items-center gap-4 ml-auto">
        <div class="w-36 h-11 bg-gray-200 rounded-lg"></div>
      </div>

    </div>
  `
})
export class SkeletonLoaderComponent {}

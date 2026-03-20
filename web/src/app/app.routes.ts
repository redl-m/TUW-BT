import { Routes } from '@angular/router';
import { UploadComponent } from './features/upload/upload.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import {CandidateDetailComponent} from './features/candidate-detail/candidate-detail.component';

/**
 * Application routes.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'upload', pathMatch: 'full' },
  { path: 'upload', component: UploadComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'candidate/:id', component: CandidateDetailComponent }
];

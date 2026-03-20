import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Candidate } from '../models/candidate.model';

// Matches FastAPI response schema
export interface EvaluationResponse {
  candidates: Candidate[];
  job_weights: Record<string, number>;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);

  /**
   * Packages the Job Description and CVs into a multipart form
   * and POSTs them to the FastAPI backend.
   */
  processPipeline(jobFile: File, cvFiles: File[]): Observable<EvaluationResponse> {
    const formData = new FormData();

    // Append the Job Description (Single file)
    formData.append('job_file', jobFile);

    // Append each CV file under the same key (List[UploadFile] for FastAPI)
    cvFiles.forEach(file => {
      formData.append('cv_files', file);
    });

    // Forwarded to http://localhost:8000/api/evaluate by proxy.conf.json
    return this.http.post<EvaluationResponse>('/api/evaluate', formData);
  }
}

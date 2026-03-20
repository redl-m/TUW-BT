import { Injectable, inject, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Service for interacting with the backend API.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private zone = inject(NgZone);
  private ws: WebSocket | null = null;

  /**
   * Upload a job description file.
   * @param jobFile The file to upload.
   * @returns An observable that emits the response from the server.
   */
  uploadJob(jobFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', jobFile);
    return this.http.post('/api/upload/job', formData);
  }

  /**
   * Upload a list of candidate resumes.
   * @param cvFiles An array of files to upload.
   * @returns An observable that emits the response from the server.
   */
  uploadCvs(cvFiles: File[]): Observable<any> {
    const formData = new FormData();
    cvFiles.forEach(file => formData.append('files', file));
    return this.http.post('/api/upload/cvs', formData);
  }

  /**
   * Prioritize a candidate by sending a request to the backend.
   * @param candidateId The ID of the candidate to prioritize.
   * @returns An observable that emits the response from the server.
   */
  prioritizeCandidate(candidateId: string): Observable<any> {
    return this.http.post(`/api/candidates/${candidateId}/prioritize`, {});
  }

  /**
   * Connect to the WebSocket for candidate updates.
   * @param onUpdate A callback function to handle incoming updates.
   */
  connectToCandidateUpdates(onUpdate: (data: any) => void) {
    this.connectWS(onUpdate);
  }

  /**
   * Connect to the WebSocket for candidate updates.
   * @param onUpdate A callback function to handle incoming updates.
   * @private
   */
  private connectWS(onUpdate: (data: any) => void) {
    this.ws = new WebSocket('ws://localhost:8000/ws/candidates');

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // wrap update to ensure updates are handled immediately
      this.zone.run(() => {
        onUpdate(data.candidates);
      });
    };

    this.ws.onclose = () => {
      console.warn('WebSocket closed. Attempting to reconnect in 2 seconds...');
      setTimeout(() => this.connectWS(onUpdate), 2000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      this.ws?.close(); // Force the close event to trigger reconnection
    };
  }
}

import {Injectable, inject, NgZone} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

/**
 * Service for interacting with the backend API.
 */
@Injectable({providedIn: 'root'})
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
   * Get the current weights for each feature.
   * @returns An observable that emits the current weights.
   */
  updateWeights(weights: any): Observable<any> {
    return this.http.post('/api/weights', {weights});
  }

  /**
   * Get the current LLM settings and connection status from the backend.
   * @returns An observable that emits the current settings and status.
   */
  getLlmStatus(): Observable<any> {
    return this.http.get('/api/llm/status');
  }

  /**
   * Update the LLM configuration (switch between API/Local, set keys, etc.).
   * @param settings The LLM settings payload.
   * @returns An observable confirming the update.
   */
  updateLlmSettings(settings: any): Observable<any> {
    return this.http.post('/api/llm/settings', settings);
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

      this.zone.run(() => {
        onUpdate(data); // Pass the entire object
      });
    };

    this.ws.onclose = () => {
      console.warn('WebSocket closed. Attempting to reconnect in 2 seconds...');
      setTimeout(() => this.connectWS(onUpdate), 2000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      this.ws?.close();
    };
  }
}

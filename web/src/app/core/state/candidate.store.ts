import {patchState, signalStore, withMethods, withState} from '@ngrx/signals';
import {Candidate} from '../models/candidate.model';

interface CandidateState {
  candidates: Candidate[];
  jobWeights: Record<string, number>;
  isProcessing: boolean;
  expectedCandidateCount: number;
}

const initialState: CandidateState = {
  candidates: [],
  jobWeights: {},
  isProcessing: false,
  expectedCandidateCount: 0,
};

/**
 * Recalculates the user score for each candidate based on SHAP modifications.
 * @param candidates The list of candidates to recalculate.
 * @param weights The current weights for each feature (1 to 5).
 */
function recalculateAndSort(candidates: Candidate[], weights: Record<string, number>): Candidate[] {

  const updated = candidates.map(candidate => {
    const safeRfScore = candidate.rf_score || 0;
    const shapValues = candidate.shap_values || {};

    // Reverse-engineer the base value (Expected Value)
    let shapSum = 0;
    // BaseValue = RF_Score - Sum(SHAP_Values
    Object.values(shapValues).forEach(val => {
      shapSum += val;
    });
    // Accumulate modified user score
    let finalUserScore = safeRfScore - shapSum;

    Object.entries(shapValues).forEach(([featureName, shapVal]) => {

      const rawWeight = weights[featureName] !== undefined ? weights[featureName] : 3.0;
      const multiplier = (rawWeight - 1.0) / 4.0; // Multiplier mapping
      finalUserScore += (shapVal * multiplier);
    });

    // Ensure the final score strictly bounds between 0.0 and 1.0
    finalUserScore = Math.max(0, Math.min(finalUserScore, 1.0));

    // Calculate risk flag
    const riskFlag = finalUserScore > safeRfScore && (finalUserScore - safeRfScore) >= 0.20;

    return {
      ...candidate,
      user_score: finalUserScore,
      risk_flag: riskFlag
    };
  });

  // Sort descending by the newly calculated user score
  return updated.sort((a, b) => (b.user_score || 0) - (a.user_score || 0));
}

/**
 * Signal-based store for managing candidate data.
 */
export const CandidateStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({

    setIsProcessing(isProcessing: boolean) {
      patchState(store, { isProcessing });
    },

    setCandidates(candidates: Candidate[]) {
      patchState(store, { candidates });
    },

    setJobWeights(jobWeights: Record<string, number>) {
      patchState(store, { jobWeights });
    },

    setExpectedCandidateCount(count: number) {
      patchState(store, { expectedCandidateCount: count });
    },

    updateWeight(feature: string, weight: number) {
      // Update the slider weight
      patchState(store, (state) => ({
        jobWeights: { ...state.jobWeights, [feature]: weight }
      }));

      // Recalculate using the helper
      patchState(store, (state) => ({
        candidates: recalculateAndSort(state.candidates, state.jobWeights)
      }));
    },

    connectWebSocket() {
      const socket = new WebSocket('ws://localhost:8000/ws/candidates');

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.candidates && data.candidates.length > 0) {

          // Intercept incoming data and recalculate user scores based on the current weights
          patchState(store, (state) => ({
            candidates: recalculateAndSort(data.candidates, state.jobWeights)
          }));

        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
      };
    },

    /**
     * Remove a candidate from the store.
     * @param candidateId The ID of the candidate to delete.
     */
    removeCandidate(candidateId: string) {
      patchState(store, (state) => ({
        candidates: state.candidates.filter(c => c.id !== candidateId)
      }));
    }
  }))
);

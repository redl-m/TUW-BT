import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Candidate } from '../models/candidate.model';

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
 * Recalculates the user score for each candidate based on the current weights.
 * @param candidates The list of candidates to recalculate.
 * @param weights The current weights for each feature.
 */
function recalculateAndSort(candidates: Candidate[], weights: Record<string, number>): Candidate[] {

  // Max values as defined in backend
  const MAX_VALUES: Record<string, number> = {
    "Experience (Years)": 10.0,
    "Projects Count": 10.0,
    "Structural Adherence": 5.0,
    "Adaptive Fluidity": 5.0,
    "Interpersonal Influence": 5.0,
    "Execution Velocity": 5.0,
    "Psychological Resilience": 5.0
  };

  const updated = candidates.map(candidate => {
    let numerator = 0;
    let denominator = 0;

    Object.entries(weights).forEach(([key, currentWeight]) => {
      const rawValue = candidate.features[key] || 0;
      const maxVal = MAX_VALUES[key] || 5.0;
      const normalizedValue = Math.min(rawValue / maxVal, 1.0);

      numerator += (normalizedValue * currentWeight);
      denominator += currentWeight;
    });

    const finalUserScore = denominator > 0 ? numerator / denominator : 0;
    const safeRfScore = candidate.rf_score || 0;
    const riskFlag = (finalUserScore - safeRfScore) > 0.15;

    return {
      ...candidate,
      user_score: finalUserScore,
      risk_flag: riskFlag
    };
  });

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
    }

  }))
);

export interface CandidateFeatures {
  'Experience (Years)': number;
  'Education': string;
  'Certifications': string;
  'Job Role': string;
  'Projects Count': number;
  'Job Hopping': string;
  'Technical Skills': string[];
  'Structural Adherence': number;
  'Adaptive Fluidity': number;
  'Interpersonal Influence': number;
  'Execution Velocity': number;
  'Psychological Resilience': number;

  [key: string]: any;
}

export interface Candidate {
  id: string;
  name: string;
  features: CandidateFeatures;
  rf_score: number | null;
  user_score: number | null;
  risk_flag: boolean;
  shap_values: Record<string, number> | null;
  executive_summary: string;
  interview_questions: string[];
}

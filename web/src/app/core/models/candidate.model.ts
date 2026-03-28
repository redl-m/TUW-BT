export interface CandidateFeatures {
  'years_of_experience': number;
  'education_level': string;
  'projects_count': number;
  'job_hopping': string;
  'technical_skills': string[];
  'structural_adherence': number;
  'adaptive_fluidity': number;
  'interpersonal_influence': number;
  'execution_velocity': number;
  'psychological_resilience': number;

  [key: string]: any;
}

export interface Candidate {
  id: string;
  name: string;
  original_filename?: string;
  features: CandidateFeatures;
  rf_score: number | null;
  user_score: number | null;
  risk_flag: boolean;
  shap_values: Record<string, number> | null;
  executive_summary: string;
  interview_questions: string[];
}

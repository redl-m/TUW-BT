from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class CandidateFeatures(BaseModel):
    # Core Attributes
    years_of_experience: int = Field(default=0, alias="years_of_experience")
    education: str = Field(default="", alias="education_level")
    projects_count: int = Field(default=0, alias="projects_count")
    job_hopping: str = Field(default="Low", alias="job_hopping")

    # Technical Skills List as array
    technical_skills: List[str] = Field(default_factory=list, alias="technical_skills")

    # Soft skills
    structural_adherence: int = Field(default=0, alias="structural_adherence")
    adaptive_fluidity: int = Field(default=0, alias="adaptive_fluidity")
    interpersonal_influence: int = Field(default=0, alias="interpersonal_influence")
    execution_velocity: int = Field(default=0, alias="execution_velocity")
    psychological_resilience: int = Field(default=0, alias="psychological_resilience")

    class Config:
        populate_by_name = True


class Candidate(BaseModel):
    id: str
    name: str = "Unknown Candidate"
    features: CandidateFeatures

    # Scoring Metrics
    rf_score: Optional[float] = None
    user_score: Optional[float] = None
    risk_flag: bool = False
    shap_values: Optional[Dict[str, float]] = None

    # XAI Generative Outputs
    executive_summary: str = Field(default="")
    interview_questions: List[str] = Field(default_factory=list)

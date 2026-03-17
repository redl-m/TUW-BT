from pydantic import BaseModel, Field
from typing import List


class CandidateFeatures(BaseModel):
    # Core Attributes
    experienceYears: int = Field(default=0, alias="Experience (Years)")
    education: str = Field(default="", alias="Education")
    certifications: str = Field(default="", alias="Certifications")
    jobRole: str = Field(default="", alias="Job Role")
    projectsCount: int = Field(default=0, alias="Projects Count")
    jobHopping: str = Field(default="Low", alias="Job Hopping")

    # Technical Skills List as array
    technical_skills: List[str] = Field(default_factory=list, alias="Technical Skills")

    # Fix, explicit soft skills
    structuralAdherence: int = Field(default=0, alias="Structural Adherence")
    adaptiveFluidity: int = Field(default=0, alias="Adaptive Fluidity")
    interpersonalInfluence: int = Field(default=0, alias="Interpersonal Influence")
    executionVelocity: int = Field(default=0, alias="Execution Velocity")
    psychologicalResilience: int = Field(default=0, alias="Psychological Resilience")

    class Config:
        populate_by_name = True
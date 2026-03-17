from pydantic import BaseModel, Field
from typing import Dict

class Job(BaseModel):
    id: str
    title: str = Field(default="")
    description: str = Field(default="")
    # Dynamically generated baseline weights from the LLM extraction
    baseline_weights: Dict[str, float] = Field(default_factory=dict)
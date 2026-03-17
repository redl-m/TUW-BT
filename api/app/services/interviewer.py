from typing import Dict, List
from app.models.candidate import Candidate


class InterviewerService:
    def __init__(self):
        self.temperature = 0.6 # non-deterministic for text generation

    def generate_contextual_prompt(self, candidate: Candidate, user_weights: Dict[str, float]) -> str:
        """
        Fuses the three data streams (JSON Profile, SHAP, Slider States) + Risk Flag.
        """
        prompt = f"""
        You are an expert HR assistant. Generate an executive summary and actionable interview questions 
        for the following candidate. Adapt your focus based on the recruiter's current priorities.

        [DATA STREAM 1: Candidate Profile]
        {candidate.features.model_dump_json()}

        [DATA STREAM 2: TreeSHAP Attributions (Algorithmic Logic)]
        {candidate.shap_values}

        [DATA STREAM 3: Recruiter Priorities (Dynamic Slider States)]
        {user_weights}

        [SYSTEM WARNING: Risk Flag]
        Status: {"ACTIVE - The objective AI score is significantly lower than the recruiter's subjective score." if candidate.risk_flag else "INACTIVE"}

        Instructions:
        1. Write a concise executive summary.
        2. Generate up to 3 follow-up questions. If the Risk Flag is ACTIVE, at least one question MUST probe the discrepancy.
        3. Prioritize questioning around features that the recruiter marked as "Critical" (high weight).
        """
        return prompt
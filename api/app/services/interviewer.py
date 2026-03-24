import json
import re
from typing import Dict, Tuple, List
from app.models.candidate import Candidate


class InterviewerService:
    def __init__(self, llm_manager):
        self.llm = llm_manager

    def _build_prompt(self, candidate: Candidate, user_weights: Dict[str, float]) -> list:
        # System instructions define the persona, constraints, and JSON requirement
        system_instruction = (
            "You are an expert HR assistant. Generate an executive summary and actionable "
            "interview questions for the following candidate. Adapt your focus based on the "
            "recruiter's current priorities.\n\n"
            "Instructions:\n"
            "1. Write a concise executive summary.\n"
            "2. Generate up to 3 follow-up questions. If the Risk Flag is ACTIVE, at least "
            "one question MUST probe the discrepancy.\n"
            "3. Prioritize questioning around features that the recruiter marked as 'Critical' (high weight).\n"
            "4. STRICT RULE: Your output must be a valid JSON object with exactly two keys: "
            "'executive_summary' (string) and 'interview_questions' (list of strings)."
        )

        # User content maps to the data streams, formatting them for the LLM
        user_content = (
            f"[DATA STREAM 1: Candidate Profile]\n"
            f"{candidate.features.model_dump_json()}\n\n"
            f"[DATA STREAM 2: TreeSHAP Attributions (Algorithmic Logic)]\n"
            f"{json.dumps(candidate.shap_values, indent=2)}\n\n"
            f"[DATA STREAM 3: Recruiter Priorities (Dynamic Slider States)]\n"
            f"{json.dumps(user_weights, indent=2)}\n\n"
            f"[SYSTEM WARNING: Risk Flag]\n"
            f"Status: {'ACTIVE - The objective AI score is significantly lower than the recruiter\'s subjective score.' if candidate.risk_flag else 'INACTIVE'}"
        )

        return [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_content}
        ]

    def generate_narrative(self, candidate: Candidate, user_weights: Dict[str, float]) -> Tuple[str, List[str]]:
        messages = self._build_prompt(candidate, user_weights)

        # Creative generation
        response_text = self.llm.generate(messages, max_tokens=768, temperature=0.6, do_sample=True)

        try:
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not match:
                raise ValueError("No valid JSON structure found.")
            result = json.loads(match.group(0))
            return result.get("executive_summary", ""), result.get("interview_questions", [])
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Narrative generation failed: {e}\nRaw output: {response_text}")
            return "Failed to generate summary.", ["Please review the candidate's profile manually."]
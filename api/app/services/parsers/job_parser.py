import json
import re
from typing import Dict


class JobParserService:
    def __init__(self, llm_manager):
        self.llm = llm_manager

    def _build_prompt(self, job_text: str) -> list:
        # TODO: currently no education required
        json_schema = {
            "type": "object",
            "properties": {
                "Experience (Years)": {"type": "integer", "minimum": 1, "maximum": 5},
                "Projects Count": {"type": "integer", "minimum": 1, "maximum": 5},
                "Structural Adherence": {"type": "integer", "minimum": 1, "maximum": 5},
                "Adaptive Fluidity": {"type": "integer", "minimum": 1, "maximum": 5},
                "Interpersonal Influence": {"type": "integer", "minimum": 1, "maximum": 5},
                "Execution Velocity": {"type": "integer", "minimum": 1, "maximum": 5},
                "Psychological Resilience": {"type": "integer", "minimum": 1, "maximum": 5}
            },
            "required": [
                "Experience (Years)", "Projects Count", "Structural Adherence",
                "Adaptive Fluidity", "Interpersonal Influence", "Execution Velocity",
                "Psychological Resilience"
            ]
        }

        system_instruction = (
            "You are an expert HR extraction system. Read the provided job description and evaluate "
            "how critical each feature is for this specific role. Rate the importance of each feature "
            "on a scale from 1 (Ignore) to 5 (Critical).\n\n"
            f"SCHEMA:\n{json.dumps(json_schema, indent=2)}\n\n"
            "Output ONLY valid JSON matching the schema."
        )

        return [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": f"Extract baseline weights for this job:\n\n{job_text}"}
        ]

    def extract_baseline_weights(self, job_text: str) -> Dict[str, float]:
        messages = self._build_prompt(job_text)

        # Deterministic extraction
        response_text = self.llm.generate(messages, max_tokens=512, do_sample=False)

        try:
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not match:
                raise ValueError("No valid JSON structure found.")
            return json.loads(match.group(0))
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Weight extraction failed: {e}\nRaw Output: {response_text}")
            return {
                "Experience (Years)": 3, "Projects Count": 3, "Structural Adherence": 3,
                "Adaptive Fluidity": 3, "Interpersonal Influence": 3, "Execution Velocity": 3,
                "Psychological Resilience": 3
            }
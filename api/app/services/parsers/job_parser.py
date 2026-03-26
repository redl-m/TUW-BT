import json
import re

class JobParserService:
    def __init__(self, llm_manager):
        self.llm = llm_manager

    def _build_prompt(self, job_text: str) -> list:

        # Get slider importance weights
        json_schema = {
            "type": "object",
            "properties": {
                "years_of_experience": {"type": "integer", "minimum": 1, "maximum": 5},
                "education_level": {"type": "integer", "minimum": 1, "maximum": 5},
                "structural_adherence": {"type": "integer", "minimum": 1, "maximum": 5},
                "adaptive_fluidity": {"type": "integer", "minimum": 1, "maximum": 5},
                "interpersonal_influence": {"type": "integer", "minimum": 1, "maximum": 5},
                "execution_velocity": {"type": "integer", "minimum": 1, "maximum": 5},
                "psychological_resilience": {"type": "integer", "minimum": 1, "maximum": 5}
            },
            "required": [
                "years_of_experience", "education_level", "structural_adherence",
                "adaptive_fluidity", "interpersonal_influence", "execution_velocity",
                "psychological_resilience"
            ]
        }

        system_instruction = (
            "You are an expert HR extraction system. Read the provided job description and evaluate "
            "how critical each feature is for this specific role. Rate the importance of each feature "
            "strictly on a scale from 1 (Ignore) to 5 (Critical).\n\n"
            f"SCHEMA:\n{json.dumps(json_schema, indent=2)}\n\n"
            "Output ONLY valid JSON matching the schema."
        )

        return [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": f"Extract baseline weights (1-5) for this job:\n\n{job_text}"}
        ]

    def extract_baseline_weights(self, job_text: str) -> dict[str, int]:
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
            # Fallback must also perfectly match feature_names.json keys
            return {
                "years_of_experience": 3,
                "education_level": 3,
                "structural_adherence": 3,
                "adaptive_fluidity": 3,
                "interpersonal_influence": 3,
                "execution_velocity": 3,
                "psychological_resilience": 3
            }
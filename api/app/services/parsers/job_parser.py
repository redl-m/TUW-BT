import json
from typing import Dict


class JobParserService:
    def __init__(self, model, tokenizer):
        # TODO: Model and tokenizer should be passed in from a central LLM manager to save VRAM
        self.model = model
        self.tokenizer = tokenizer
        self.terminators = [
            self.tokenizer.eos_token_id,
            self.tokenizer.convert_tokens_to_ids("<|eot_id|>")
        ]

    def _build_prompt(self, job_text: str) -> list:
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

        input_ids = self.tokenizer.apply_chat_template(
            messages, add_generation_prompt=True, return_tensors="pt"
        ).to(self.model.device)

        outputs = self.model.generate(
            input_ids,
            max_new_tokens=512,
            eos_token_id=self.terminators,
            do_sample=False  # Temperature 0.0 for deterministic extraction
        )

        response_text = self.tokenizer.decode(outputs[0][input_ids.shape[-1]:], skip_special_tokens=True)

        try:
            cleaned_text = response_text.strip()
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text[7:]
            if cleaned_text.endswith("```"):
                cleaned_text = cleaned_text[:-3]

            weights = json.loads(cleaned_text.strip())
            return weights

        except (json.JSONDecodeError, ValueError) as e:
            print(f"Weight extraction failed: {e}")
            # Fallback to neutral weights if parsing fails
            return {
                "Experience (Years)": 3, "Projects Count": 3, "Structural Adherence": 3,
                "Adaptive Fluidity": 3, "Interpersonal Influence": 3, "Execution Velocity": 3,
                "Psychological Resilience": 3
            }
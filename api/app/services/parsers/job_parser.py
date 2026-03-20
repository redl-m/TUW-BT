import json
import re
from typing import Dict


class JobParserService:
    def __init__(self, model, tokenizer):
        self.model = model
        self.tokenizer = tokenizer
        self.terminators = [
            self.tokenizer.eos_token_id,
            self.tokenizer.convert_tokens_to_ids("<|eot_id|>")
        ]

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

        # Return dict
        inputs = self.tokenizer.apply_chat_template(
            messages, add_generation_prompt=True, return_tensors="pt", return_dict=True
        ).to(self.model.device)

        # Unpack with **
        outputs = self.model.generate(
            **inputs,
            max_new_tokens=512,
            eos_token_id=self.terminators,
            do_sample=False  # Temperature 0.0 for deterministic extraction
        )

        # Decode only the new tokens
        input_length = inputs['input_ids'].shape[-1]
        response_text = self.tokenizer.decode(outputs[0][input_length:], skip_special_tokens=True)

        try:
            # Regex JSON Extraction
            match = re.search(r'\{.*\}', response_text, re.DOTALL)

            if not match:
                raise ValueError("No valid JSON structure found in the LLM response.")

            json_str = match.group(0)
            weights = json.loads(json_str)
            return weights

        except (json.JSONDecodeError, ValueError) as e:
            print(f"Weight extraction failed: {e}\nRaw Output: {response_text}")
            # Fallback to neutral weights if parsing fails
            return {
                "Experience (Years)": 3, "Projects Count": 3, "Structural Adherence": 3,
                "Adaptive Fluidity": 3, "Interpersonal Influence": 3, "Execution Velocity": 3,
                "Psychological Resilience": 3
            }
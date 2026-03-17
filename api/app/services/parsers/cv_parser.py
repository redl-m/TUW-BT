import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from app.models.candidate import CandidateFeatures


class CVParserService:
    # 1. Point to downloaded folder
    def __init__(self,
                 model_id: str = r"D:\huggingface\hub\models--meta-llama--Meta-Llama-3.1-8B-Instruct\snapshots\0e9e39f249a16976918f6564b8830bc894c89659"):
        print("Initializing Llama-3.1-8B via Hugging Face...")

        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )

        # 2. Force Offline Mode
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_id,
            local_files_only=True
        )

        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            device_map="auto",
            quantization_config=quantization_config,
            dtype=torch.float16,
            local_files_only=True
        )

        self.terminators = [
            self.tokenizer.eos_token_id,
            self.tokenizer.convert_tokens_to_ids("<|eot_id|>")
        ]

    def _build_prompt(self, cv_text: str) -> list:
        """Constructs the prompt using Llama 3's native chat template."""

        # JSON schema
        json_schema = {
            "type": "object",
            "properties": {
                "Technical Skills": {"type": "array", "items": {"type": "string"}},
                "Experience (Years)": {"type": "integer"},
                "Education": {"type": "string"},
                "Certifications": {"type": "string"},
                "Job Role": {"type": "string"},
                "Projects Count": {"type": "integer"},
                "Job Hopping": {"type": "string"},
                "Structural Adherence": {"type": "integer"},
                "Adaptive Fluidity": {"type": "integer"},
                "Interpersonal Influence": {"type": "integer"},
                "Execution Velocity": {"type": "integer"},
                "Psychological Resilience": {"type": "integer"}
            }
        }

        system_instruction = (
            "You are a deterministic data extraction system. Your exact task is to extract information "
            "from the provided resume and format it STRICTLY as a JSON object matching the schema below.\n\n"
            f"SCHEMA:\n{json.dumps(json_schema, indent=2)}\n\n"
            "CRITICAL RULES (Structural Omission Strategy):\n"
            "1. NEVER hallucinate or invent data.\n"
            "2. If an integer field is completely missing from the resume, output 0.\n"
            "3. If a string field is completely missing, output \"\".\n"
            "4. Output ONLY valid JSON. Do not include markdown formatting, explanations, or conversational text."
        )

        return [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": f"Extract the data from this resume:\n\n{cv_text}"}
        ]

    def parse_cv(self, cv_text: str) -> CandidateFeatures:
        """Runs the deterministic extraction and validates via Pydantic."""

        messages = self._build_prompt(cv_text)

        input_ids = self.tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=True,
            return_tensors="pt"
        ).to(self.model.device)

        # Deterministic generation settings using temperature 0.0
        outputs = self.model.generate(
            input_ids,
            max_new_tokens=1024,
            eos_token_id=self.terminators,
            do_sample=False,  # Enforces greedy decoding
            temperature=None,
            top_p=None
        )

        # Decode only the generated response
        response_text = self.tokenizer.decode(outputs[0][input_ids.shape[-1]:], skip_special_tokens=True)

        return self._clean_and_validate(response_text)

    def _clean_and_validate(self, response_text: str) -> CandidateFeatures:
        """Cleans potential markdown from the LLM and enforces the Pydantic contract."""
        try:
            # Strip standard markdown JSON blocks if the LLM accidentally includes them
            cleaned_text = response_text.strip()
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text[7:]
            if cleaned_text.endswith("```"):
                cleaned_text = cleaned_text[:-3]

            parsed_dict = json.loads(cleaned_text.strip())

            # Let Pydantic handle the mapping via the aliases set in candidate.py
            return CandidateFeatures(**parsed_dict)

        except (json.JSONDecodeError, ValueError) as e:
            print(f"Extraction failed or violated schema: {e}\nRaw Output: {response_text}")
            return CandidateFeatures() # fallback to default

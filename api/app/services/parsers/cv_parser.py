import json
import torch
import re
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from app.models.candidate import CandidateFeatures

class CVParserService:
    def __init__(self,
                 model_id: str = r"D:\huggingface\hub\models--meta-llama--Meta-Llama-3.1-8B-Instruct\snapshots\0e9e39f249a16976918f6564b8830bc894c89659"):
        print("Initializing Llama-3.1-8B via Hugging Face...")

        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )

        self.tokenizer = AutoTokenizer.from_pretrained(model_id, local_files_only=True)
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
        json_schema = {
            "type": "object",
            "properties": {
                "Name": {
                    "type": "string",
                    "description": "The candidate's full name. If not found, output 'Unknown Candidate'"
                },
                "Technical Skills": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of specific technical skills, programming languages, and tools"
                },
                "Experience (Years)": {
                    "type": "integer",
                    "description": "Total years of professional experience"
                },
                "Education": {
                    "type": "string",
                    "description": "Highest degree (e.g., B.Sc, B.Tech, M.Tech, MBA, PhD, None)"
                },
                "Certifications": {
                    "type": "string",
                    "description": "Key certifications (e.g., AWS Certified, Google ML, None)"
                },
                "Job Role": {
                    "type": "string",
                    "description": "Current or primary job role title"
                },
                "Projects Count": {
                    "type": "integer",
                    "description": "Number of distinct projects listed"
                },
                "Job Hopping": {
                    "type": "string",
                    "description": "Assess frequency of job changes: 'Low', 'Medium', or 'High'"
                },
                "Structural Adherence": {
                    "type": "integer",
                    "description": "Rate 1-5 how well resume matches standard professional structures"
                },
                "Adaptive Fluidity": {
                    "type": "integer",
                    "description": "Rate 1-5 evidence of learning new technologies quickly"
                },
                "Interpersonal Influence": {
                    "type": "integer",
                    "description": "Rate 1-5 evidence of leadership, mentoring, or teamwork"
                },
                "Execution Velocity": {
                    "type": "integer",
                    "description": "Rate 1-5 evidence of delivering projects quickly or meeting deadlines"
                },
                "Psychological Resilience": {
                    "type": "integer",
                    "description": "Rate 1-5 evidence of overcoming challenges or long-term dedication"
                }
            },
            "required": [
                "Name", "Technical Skills", "Experience (Years)", "Education", "Certifications", # <-- Added Name here
                "Job Role", "Projects Count", "Job Hopping", "Structural Adherence",
                "Adaptive Fluidity", "Interpersonal Influence", "Execution Velocity",
                "Psychological Resilience"
            ]
        }

        system_instruction = (
            "You are a deterministic data extraction system. Your exact task is to extract information "
            "from the provided resume and format it STRICTLY as a JSON object matching the schema below.\n\n"
            f"SCHEMA:\n{json.dumps(json_schema, indent=2)}\n\n"
            "CRITICAL RULES (Structural Omission Strategy):\n"
            "1. NEVER hallucinate or invent data.\n"
            "2. If an integer field is completely missing from the resume, output 0.\n"
            "3. If a string field is completely missing, output \"\".\n"
            "4. DO NOT echo the JSON schema back in your response.\n"
            "5. Output ONLY valid JSON. Do not include markdown formatting (like ```json), explanations, "
            "or conversational text."
        )

        return [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": f"Extract the data from this resume:\n\n{cv_text}"}
        ]

    def parse_cv(self, cv_text: str) -> tuple[str, CandidateFeatures]:
        messages = self._build_prompt(cv_text)

        inputs = self.tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=True,
            return_tensors="pt",
            return_dict=True
        ).to(self.model.device)

        outputs = self.model.generate(
            **inputs,
            max_new_tokens=1024,
            eos_token_id=self.terminators,
            do_sample=False,
            temperature=None,
            top_p=None
        )

        input_length = inputs['input_ids'].shape[-1]
        response_text = self.tokenizer.decode(outputs[0][input_length:], skip_special_tokens=True)

        return self._clean_and_validate(response_text)

    # Extracts the name before passing the rest to Pydantic
    def _clean_and_validate(self, response_text: str) -> tuple[str, CandidateFeatures]:
        try:
            decoder = json.JSONDecoder()
            parsed_dicts = []
            idx = 0

            # Extract all valid JSON objects from the text natively
            while idx < len(response_text):
                idx = response_text.find('{', idx)
                if idx == -1:
                    break
                try:
                    obj, end_offset = decoder.raw_decode(response_text[idx:])
                    parsed_dicts.append(obj)
                    idx += end_offset  # Move past the parsed object
                except json.JSONDecodeError:
                    idx += 1  # Move forward one character and try again

            if not parsed_dicts:
                raise ValueError("No valid JSON structure found in the LLM response.")

            # Iterate in reverse to prefer the final generated object
            candidate_data = None
            for parsed_dict in reversed(parsed_dicts):
                # Ignore the schema block if the LLM echoed it back
                if "properties" in parsed_dict and "type" in parsed_dict:
                    continue

                # Verify it has at least some candidate fields to qualify
                if "Name" in parsed_dict:
                    candidate_data = parsed_dict
                    break

            if not candidate_data:
                raise ValueError("Could not find valid candidate data matching the schema.")

            # Extract name and return mapped features
            extracted_name = candidate_data.pop("Name", "Unknown Candidate")
            return extracted_name, CandidateFeatures(**candidate_data)

        except Exception as e:
            print(f"❌ CV Extraction failed or violated schema: {e}\nRaw Output: {response_text}")
            return "Unknown Candidate", CandidateFeatures()
import json
import torch
import re
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from app.models.candidate import CandidateFeatures

class CVParserService:
    def __init__(self, llm_manager):
        self.llm = llm_manager

    def _build_prompt(self, cv_text: str) -> list:
        json_schema = {
            "type": "object",
            "properties": {
                "Name": {
                    "type": "string",
                    "description": "The candidate's full name. If not found, output 'Unknown Candidate'"
                },
                "technical_skills": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of specific technical skills, programming languages, and tools"
                },
                "years_of_experience": {
                    "type": "integer",
                    "description": "Total years of professional experience"
                },
                "education": {
                    "type": "string",
                    "description": "Highest degree (e.g., B.Sc, B.Tech, M.Tech, MBA, PhD, None)"
                },
                "projects_count": {
                    "type": "integer",
                    "description": "Number of distinct projects listed"
                },
                "job_hopping": {
                    "type": "string",
                    "description": "Assess frequency of job changes: 'Low', 'Medium', or 'High'"
                },
                "structural_adherence": {
                    "type": "integer",
                    "description": "Rate 1-5 how well resume matches standard professional structures"
                },
                "adaptive_fluidity": {
                    "type": "integer",
                    "description": "Rate 1-5 evidence of learning new technologies quickly"
                },
                "interpersonal_influence": {
                    "type": "integer",
                    "description": "Rate 1-5 evidence of leadership, mentoring, or teamwork"
                },
                "execution_velocity": {
                    "type": "integer",
                    "description": "Rate 1-5 evidence of delivering projects quickly or meeting deadlines"
                },
                "psychological_resilience": {
                    "type": "integer",
                    "description": "Rate 1-5 evidence of overcoming challenges or long-term dedication"
                }
            },
            "required": [
                "Name", "technical_skills", "years_of_experience", "education",
                "projects_count", "job_hopping", "structural_adherence",
                "adaptive_fluidity", "interpersonal_influence", "execution_velocity",
                "psychological_resilience"
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

        # Use central LLM manager
        response_text = self.llm.generate(messages, max_tokens=1024, do_sample=False)
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
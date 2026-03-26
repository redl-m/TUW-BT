import json
import logging
import time
from pathlib import Path
from openai import OpenAI, APIConnectionError, RateLimitError

# logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# API Configuration
API_KEY = ""
BASE_URL = "https://aqueduct.ai.datalab.tuwien.ac.at/v1"
MODEL_NAME = "qwen-coder-30b"

# Initialize the client pointing to your specific HPC endpoint
client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

SYSTEM_PROMPT = """
You are a senior HR analyst and organizational psychologist expert system. Your task is to perform deterministic data extraction from unstructured resume text and job descriptions. You must extract technical constraints (experience, education) and precisely evaluate five specific soft skills on a scale of 1 to 5. 

You must output strictly valid JSON. Do not invent data. If a specific metric or skill is missing, output 0 for numerical fields or null for text strings.

Soft Skill Evaluation Matrix (1 = Lowest/Opposite, 5 = Highest/Critical):
1. Structural Adherence: Capacity to thrive in established hierarchies, respect legacy constraints, and follow strict protocols.
2. Adaptive Fluidity: Ability to function without clear instructions, switch contexts rapidly, and accept undefined roles.
3. Interpersonal Influence: Capability to navigate complex social dynamics, persuade stakeholders, and drive alignment without direct authority.
4. Execution Velocity: Prioritization of speed and output over perfection or thoroughness (bias for action).
5. Psychological Resilience: Emotional stability to handle negative input, failure, isolation, or delayed rewards.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "technical_skills": [<array of strings: specific technical skills, programming languages, and tools>],
  "years_of_experience": <integer: total years of professional experience>,
  "education": <string: Highest degree (e.g., B.Sc, B.Tech, M.Tech, MBA, PhD, None)>,
  "projects_count": <integer: number of distinct projects listed>,
  "job_hopping": <string: 'Low', 'Medium', or 'High'>,
  "structural_adherence": <integer 1-5>,
  "adaptive_fluidity": <integer 1-5>,
  "interpersonal_influence": <integer 1-5>,
  "execution_velocity": <integer 1-5>,
  "psychological_resilience": <integer 1-5>
}
"""

def get_processed_ids(output_file: Path) -> set:
    """Reads the output file to build a set of already processed file_ids for checkpointing."""
    processed = set()
    if output_file.exists():
        with open(output_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    record = json.loads(line)
                    processed.add(record["file_id"])
                except json.JSONDecodeError:
                    continue
    return processed

def query_llm_with_retry(job_description: str, resume: str, max_retries: int = 5) -> dict:
    """Handles the API call with exponential backoff for rate limits and connection drops."""
    user_content = f"Job Description:\n{job_description}\n\nResume:\n{resume}"
    
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.0, # Deterministic JSON extraction
                response_format={"type": "json_object"} # Forces JSON output
            )
            
            raw_output = response.choices[0].message.content
            if raw_output.startswith("```"):
                raw_output = raw_output.strip("` \n")
                if raw_output.startswith("json"):
                    raw_output = raw_output[4:].strip(" \n")

            return json.loads(raw_output)
            
        except RateLimitError:
            wait_time = (2 ** attempt) * 2
            logging.warning(f"Rate limit hit. Retrying in {wait_time} seconds...")
            time.sleep(wait_time)
        except APIConnectionError:
            wait_time = (2 ** attempt) * 5
            logging.warning(f"Connection error. Retrying in {wait_time} seconds...")
            time.sleep(wait_time)
        except json.JSONDecodeError:
            logging.error("LLM returned malformed JSON. Skipping to next attempt.")
            time.sleep(1)
        except Exception as e:
            logging.error(f"Unexpected error during API call: {e}")
            break
            
    return None # Return None if all retries fail

def augment_dataset():
    base_dir = Path("../")
    input_file = base_dir / "data" / "training" / "cleaned_baseline.jsonl"
    output_file = base_dir / "data" / "training" / "augmented_training_data.jsonl"
    
    if not input_file.exists():
        logging.error(f"Baseline file not found at {input_file}. Run 00_dataset_preprocessing.py first.")
        return

    # Load checkpoint state
    processed_ids = get_processed_ids(output_file)
    logging.info(f"Found {len(processed_ids)} already processed records. Resuming...")

    total_processed_this_session = 0
    total_failed = 0

    # Open the output file in append mode for continuous saving
    with open(output_file, 'a', encoding='utf-8') as out_f:
        with open(input_file, 'r', encoding='utf-8') as in_f:
            for line in in_f:
                record = json.loads(line)
                file_id = record["file_id"]
                
                # Checkpointing check
                if file_id in processed_ids:
                    continue
                    
                logging.info(f"Processing candidate {file_id}...")
                
                extracted_features = query_llm_with_retry(
                    job_description=record["job_description"],
                    resume=record["resume"]
                )
                
                if extracted_features:
                    # Merge the newly extracted features with the baseline data
                    augmented_record = {**record, "extracted_features": extracted_features}
                    out_f.write(json.dumps(augmented_record) + '\n')
                    out_f.flush() # Force write to disk immediately to secure the checkpoint
                    total_processed_this_session += 1
                else:
                    logging.error(f"Failed to extract features for {file_id} after maximum retries.")
                    total_failed += 1

    # Provide summary
    logging.info("--- Augmentation Complete ---")
    logging.info(f"Records processed this session: {total_processed_this_session}")
    logging.info(f"Failed records: {total_failed}")

if __name__ == "__main__":
    augment_dataset()

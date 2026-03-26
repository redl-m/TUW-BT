import json
import logging
from pathlib import Path

# Logging info
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def process_local_dataset():
    # Path definition
    input_dir = Path("../data/json")
    output_dir = Path("../data/training")
    output_file = Path("../data/training/cleaned_baseline.jsonl")

    # Ensure the output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        logging.error(f"Input directory not found: {input_dir}")
        return

    cleaned_data = []
    processed_count = 0
    skipped_invalid_flag = 0
    skipped_missing_data = 0
    skipped_errors = 0

    logging.info(f"Scanning directory: {input_dir} for JSON files...")
    
    # Iterate through all JSON files in the directory
    for file_path in input_dir.glob("*.json"):
        processed_count += 1
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                item = json.load(f)
            
            output_data = item.get("output", {})
            
            # Filter out invalid JSONs explicitly
            if not output_data.get("valid_resume_and_jd", False):
                skipped_invalid_flag += 1
                continue
                
            input_data = item.get("input", {})
            
            # Extract plain text constraints
            job_description = input_data.get("job_description", "").strip()
            resume = input_data.get("resume", "").strip()
            
            if not job_description or not resume:
                skipped_missing_data += 1
                continue
                
            # Calculate target variable (Alignment Score)
            agg_scores = output_data.get("scores", {}).get("aggregated_scores", {})
            macro_score = agg_scores.get("macro_scores", 0)
            micro_score = agg_scores.get("micro_scores", 0)
            
            # Average the macro and micro scores to create a single target metric
            target_score = round((macro_score + micro_score) / 2, 2)
            
            # Append strictly the required data
            cleaned_data.append({
                "file_id": file_path.stem, # Keep the original filename ID for tracing
                "job_description": job_description,
                "resume": resume,
                "target_score": target_score
            })
            
        except json.JSONDecodeError:
            logging.warning(f"Failed to parse JSON in file: {file_path.name}")
            skipped_errors += 1
        except Exception as e:
            logging.warning(f"Unexpected error processing {file_path.name}: {e}")
            skipped_errors += 1

    # Write the cleaned data to a JSONL file
    logging.info(f"Writing {len(cleaned_data)} valid records to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        for record in cleaned_data:
            f.write(json.dumps(record) + '\n')

    # Provide summary
    logging.info("--- Preprocessing Complete ---")
    logging.info(f"Total files scanned: {processed_count}")
    logging.info(f"Successfully retained: {len(cleaned_data)}")
    logging.info(f"Dropped (Invalid flag): {skipped_invalid_flag}")
    logging.info(f"Dropped (Missing text): {skipped_missing_data}")
    logging.info(f"Dropped (Parse errors): {skipped_errors}")

if __name__ == "__main__":
    process_local_dataset()

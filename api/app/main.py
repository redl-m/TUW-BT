import torch
from fastapi import FastAPI, UploadFile, File, WebSocket, BackgroundTasks, HTTPException
from typing import List, Dict
import asyncio
import uuid
import os
import shutil
import traceback

from app.models.candidate import Candidate, CandidateFeatures
from app.services.parsers.cv_parser import CVParserService
from app.services.parsers.document_extractor import DocumentExtractor
from app.services.scorer import ScorerService
from app.services.interviewer import InterviewerService
from app.services.parsers.job_parser import JobParserService
from app.services.llm_manager import LLMManager, LLMSettings

app = FastAPI(title="Actionable Transparency in AI Recruitment")

# Ensure directories exist
os.makedirs("../data/raw_cvs", exist_ok=True)
os.makedirs("../data/raw_jobs", exist_ok=True)

# In-Memory State & Queues
candidate_queue = asyncio.PriorityQueue()
active_candidates: Dict[str, Candidate] = {}
current_job_weights: Dict[str, float] = {}
current_job_filename: str = ""

# Central LLM Manager
llm_manager = LLMManager()

# Initialize services
scorer = ScorerService()
cv_parser = CVParserService(llm_manager=llm_manager)
job_parser = JobParserService(llm_manager=llm_manager)
interviewer = InterviewerService(llm_manager=llm_manager)


async def process_queue():
    while True:
        queue_item = await candidate_queue.get()
        priority = queue_item[0]
        task_type = queue_item[1]

        if task_type == "PROCESS_JOB":
            job_id, file_path = queue_item[2], queue_item[3]
            try:
                global current_job_weights
                job_text = await DocumentExtractor.extract_text_from_path(file_path)

                # Offload heavy LLM extraction to a background thread
                current_job_weights = await asyncio.to_thread(job_parser.extract_baseline_weights, job_text)
                print(f"✅ Job Weights Processed: {current_job_weights}")

                # Iterate over a copy of the dictionary to prevent crashes due to size changes
                for cand_id in list(active_candidates.keys()):
                    # Skip if the candidate was deleted during iteration
                    if cand_id not in active_candidates:
                        continue

                    cand = active_candidates[cand_id]

                    # Only re-evaluate if CV extraction is already complete
                    if cand.features and hasattr(cand.features, 'model_dump'):
                        scores = await asyncio.to_thread(scorer.evaluate_candidate, cand.features, current_job_weights)

                        # Re-verify candidate still exists after awaiting the thread
                        if cand_id in active_candidates:
                            active_candidates[cand_id].rf_score = float(scores["rf_score"])
                            active_candidates[cand_id].user_score = float(scores["user_score"])
                            active_candidates[cand_id].info_flag = bool(scores["info_flag"])
                            active_candidates[cand_id].shap_values = {k: float(v) for k, v in
                                                                      scores.get("shap_values", {}).items()}

                            # Reset the narrative so it generates a new one based on the new job
                            active_candidates[cand_id].executive_summary = "Processing AI narrative..."
                            active_candidates[cand_id].interview_questions = []

                            # Queue up the candidate for XAI regeneration
                            await candidate_queue.put((2, "GENERATE_XAI", cand_id))

            except Exception as e:
                print(f"❌ Error processing job: {e}")

        elif task_type == "EXTRACT_CV":
            candidate_id, file_path = queue_item[2], queue_item[3]

            # Check if candidate was deleted before processing
            if candidate_id not in active_candidates:
                candidate_queue.task_done()
                continue

            try:
                raw_text = await DocumentExtractor.extract_text_from_path(file_path)
                candidate_name, features = await asyncio.to_thread(cv_parser.parse_cv, raw_text)

                # Check again if candidate was deleted during extraction
                if candidate_id not in active_candidates:
                    candidate_queue.task_done()
                    continue

                # Immediately save the extracted features so they aren't lost
                active_candidates[candidate_id].name = candidate_name
                active_candidates[candidate_id].features = features

                # Hold the candidate if the job hasn't been uploaded yet
                if not current_job_weights:
                    print(f"⏸️ Holding candidate {candidate_name} until Job Description is provided.")
                else:
                    # Job weights exist, proceed to score immediately
                    scores = await asyncio.to_thread(scorer.evaluate_candidate, features, current_job_weights)

                    # Check one last time before updating the dictionary
                    if candidate_id in active_candidates:
                        active_candidates[candidate_id].rf_score = float(scores["rf_score"])
                        active_candidates[candidate_id].user_score = float(scores["user_score"])

                        active_candidates[candidate_id].info_flag = bool(scores["info_flag"])

                        if scores.get("shap_values"):

                            active_candidates[candidate_id].shap_values = {k: float(v) for k, v in
                                                                           scores["shap_values"].items()}
                        else:
                            active_candidates[candidate_id].shap_values = {}

                        active_candidates[candidate_id].executive_summary = "Calculating AI narrative..."
                        await candidate_queue.put((2, "GENERATE_XAI", candidate_id))

            except Exception as e:
                print(f"❌ Error extracting CV for {candidate_id}")
                traceback.print_exc()

        elif task_type == "GENERATE_XAI":
            candidate_id = queue_item[2]

            # Liveness check to prevent KeyError
            if candidate_id not in active_candidates:
                candidate_queue.task_done()
                continue

            candidate = active_candidates[candidate_id]

            # Allow both initial processing and recalculating states through the gate
            valid_loading_states = [
                "Processing AI narrative...",
                "Recalculating AI narrative...",
                "Calculating AI narrative..."
            ]

            if candidate.executive_summary and candidate.executive_summary not in valid_loading_states:
                candidate_queue.task_done()
                continue

            try:
                # Offload heavy XAI Generation LLM task
                summary, questions = await asyncio.to_thread(interviewer.generate_narrative, candidate,
                                                             current_job_weights)

                # Final check before updating
                if candidate_id in active_candidates:
                    active_candidates[candidate_id].executive_summary = summary
                    active_candidates[candidate_id].interview_questions = questions
            except Exception as e:
                if candidate_id in active_candidates:
                    active_candidates[candidate_id].executive_summary = "Failed to generate narrative."
                traceback.print_exc()

        candidate_queue.task_done()


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(process_queue())


@app.post("/api/upload/job")
async def upload_job(file: UploadFile = File(...)):
    global current_job_weights
    global current_job_filename

    # Duplicate Check
    if current_job_filename.lower() == file.filename.lower():
        # Throw an HTTP 409 Conflict if it matches the currently active job
        raise HTTPException(status_code=409, detail="Job description already active.")

    current_job_filename = file.filename  # update active filename
    current_job_weights.clear()  # clear existing weights

    job_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1].lower()
    file_path = f"../data/raw_jobs/{job_id}{file_extension}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    await candidate_queue.put((0, "PROCESS_JOB", job_id, file_path))
    return {"status": "queued", "job_id": job_id}


@app.post("/api/upload/cvs")
async def upload_cvs(files: List[UploadFile] = File(...)):
    responses = []
    for file in files:
        cand_id = str(uuid.uuid4())

        # Extract and format a readable name from the filename
        original_name = file.filename
        file_extension = os.path.splitext(original_name)[1].lower()
        display_name = os.path.splitext(original_name)[0].replace("_", " ").replace("-", " ").title()

        file_path = f"../data/raw_cvs/{cand_id}{file_extension}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Pass the extracted name to the model
        active_candidates[cand_id] = Candidate(
            id=cand_id,
            name=display_name,
            original_filename=file.filename,
            features=CandidateFeatures(),
            rf_score=0.0,
            user_score=0.0,
            info_flag=False,
            shap_values={},
            executive_summary="Processing AI narrative...",
            interview_questions=[]
        )

        await candidate_queue.put((1, "EXTRACT_CV", cand_id, file_path))
        responses.append({"candidate_id": cand_id, "status": "queued"})

    return {"uploaded": responses}


@app.post("/api/candidates/{candidate_id}/prioritize")
async def prioritize_candidate(candidate_id: str):
    if candidate_id in active_candidates:
        await candidate_queue.put((0, "GENERATE_XAI", candidate_id))
        return {"status": "prioritized"}
    return {"status": "not_found"}


@app.post("/api/weights")
async def update_weights(data: dict):
    global current_job_weights
    if "weights" in data:
        current_job_weights = data["weights"]

        # Instantly recalculate user_score for all candidates already processed
        for cand_id, cand in active_candidates.items():
            if cand.rf_score and cand.rf_score > 0:
                try:
                    scores = scorer.evaluate_candidate(cand.features, current_job_weights)
                    cand.user_score = float(scores["user_score"])

                    # Use a different phrase
                    cand.executive_summary = "Recalculating AI narrative..."
                    cand.interview_questions = []

                    # Queue up the candidate for XAI regeneration
                    await candidate_queue.put((2, "GENERATE_XAI", cand_id))

                except Exception as e:
                    print(f"Failed to recalculate score and queue XAI: {e}")

    return {"status": "success"}


@app.websocket("/ws/candidates")
async def candidate_updates(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(1)
            updates = [c.model_dump(by_alias=True) for c in active_candidates.values()]

            # Check if the Job has finished processing
            is_job_processed = len(current_job_weights) > 0

            # Send defaults if not processed yet
            display_weights = current_job_weights if is_job_processed else {
                "Years of Experience": 3, "Education Level": 3, "Structural Adherence": 3,
                "Adaptive Fluidity": 3, "Interpersonal Influence": 3, "Execution Velocity": 3,
                "Psychological Resilience": 3
            }

            await websocket.send_json({
                "candidates": updates,
                "job_weights": display_weights,
                "is_job_processed": is_job_processed
            })
    except Exception as e:
        print(f"WebSocket disconnected")


@app.get("/api/llm/status")
async def get_llm_status():
    return llm_manager.get_status()


@app.post("/api/llm/settings")
async def update_llm_settings(settings: LLMSettings):
    llm_manager.update_settings(settings)
    return {"status": "success", "message": "LLM Settings updated successfully"}


@app.post("/api/llm/unload")
async def unload_llm_model():
    llm_manager.unload_local_model()
    return {"status": "success", "message": "Local model unloaded and VRAM cleared."}


@app.post("/api/llm/load")
async def load_llm_model():
    """Manual trigger to load the local model into VRAM."""
    if llm_manager.local_model is None:
        asyncio.create_task(asyncio.to_thread(llm_manager.load_local_model))
    return {"status": "success", "message": "Loading started."}


@app.get("/api/llm/stats")
async def get_llm_stats():
    vram_used = 0
    vram_total = 0
    if torch.cuda.is_available():
        free_vram, total_vram = torch.cuda.mem_get_info()
        vram_used = (total_vram - free_vram) / (1024 ** 3)
        vram_total = total_vram / (1024 ** 3)

    return {
        "used_gb": round(vram_used, 2),
        "total_gb": round(vram_total, 2),
        "percent": (vram_used / vram_total * 100) if vram_total > 0 else 0,
        "progress_str": getattr(llm_manager, 'loading_progress', ''),
        "local_status": getattr(llm_manager, 'local_status', 'unloaded')
    }


@app.delete("/api/candidates/{candidate_id}")
async def delete_candidate(candidate_id: str):
    """Removes a candidate from the active tracking dictionary."""
    if candidate_id in active_candidates:
        del active_candidates[candidate_id]
        return {"status": "success", "message": f"Candidate {candidate_id} deleted"}
    return {"status": "not_found", "message": "Candidate not found"}

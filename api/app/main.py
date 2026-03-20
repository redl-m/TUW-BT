from fastapi import FastAPI, UploadFile, File, WebSocket, BackgroundTasks
from typing import List, Dict
import asyncio
import uuid
import os
import shutil
import traceback

from app.models.job import Job
from app.models.candidate import Candidate, CandidateFeatures
from app.services.parsers.cv_parser import CVParserService
from app.services.parsers.document_extractor import DocumentExtractor
from app.services.scorer import ScorerService
from app.services.interviewer import InterviewerService
from app.services.parsers.job_parser import JobParserService

app = FastAPI(title="Actionable Transparency in AI Recruitment")

# Ensure directories exist
os.makedirs("../data/raw_cvs", exist_ok=True)
os.makedirs("../data/raw_jobs", exist_ok=True)

# In-Memory State & Queues
candidate_queue = asyncio.PriorityQueue()
active_candidates: Dict[str, Candidate] = {}
current_job_weights: Dict[str, float] = {}

# Initialize services
scorer = ScorerService()
cv_parser = CVParserService()
interviewer = InterviewerService(model=cv_parser.model, tokenizer=cv_parser.tokenizer)
job_parser = JobParserService(model=cv_parser.model, tokenizer=cv_parser.tokenizer)


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
            except Exception as e:
                print(f"❌ Error processing job: {e}")

        elif task_type == "EXTRACT_CV":

            candidate_id, file_path = queue_item[2], queue_item[3]

            try:
                raw_text = await DocumentExtractor.extract_text_from_path(file_path)
                # Unpack tuple extracted by parser
                candidate_name, features = await asyncio.to_thread(cv_parser.parse_cv, raw_text)

                while not current_job_weights:
                    await asyncio.sleep(0.5)

                scores = await asyncio.to_thread(scorer.evaluate_candidate, features, current_job_weights)

                # Update state
                active_candidates[candidate_id].name = candidate_name
                active_candidates[candidate_id].features = features
                active_candidates[candidate_id].rf_score = float(scores["rf_score"])
                active_candidates[candidate_id].user_score = float(scores["user_score"])
                active_candidates[candidate_id].risk_flag = bool(scores["risk_flag"])

                if scores.get("shap_values"):
                    active_candidates[candidate_id].shap_values = {k: float(v) for k, v in
                                                                   scores["shap_values"].items()}
                else:
                    active_candidates[candidate_id].shap_values = {}

                await candidate_queue.put((2, "GENERATE_XAI", candidate_id))

            except Exception as e:
                print(f"❌ Error extracting CV for {candidate_id}")
                traceback.print_exc()

        elif task_type == "GENERATE_XAI":
            candidate_id = queue_item[2]
            candidate = active_candidates[candidate_id]

            # Idempotency check
            if candidate.executive_summary and candidate.executive_summary != "Processing AI narrative...":
                candidate_queue.task_done()
                continue

            try:
                # Offload heavy XAI Generation LLM task
                summary, questions = await asyncio.to_thread(interviewer.generate_narrative, candidate,
                                                             current_job_weights)

                active_candidates[candidate_id].executive_summary = summary
                active_candidates[candidate_id].interview_questions = questions
            except Exception as e:
                active_candidates[candidate_id].executive_summary = "Failed to generate narrative."
                traceback.print_exc()

        candidate_queue.task_done()


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(process_queue())


@app.post("/api/upload/job")
async def upload_job(file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1].lower()
    file_path = f"../data/raw_jobs/{job_id}{file_extension}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    await candidate_queue.put((0, "PROCESS_JOB", job_id, file_path))
    return {"status": "queued", "job_id": job_id}


@app.post("/api/upload/cvs")
@app.post("/api/upload/cvs")
async def upload_cvs(files: List[UploadFile] = File(...)):
    responses = []
    for file in files:
        cand_id = str(uuid.uuid4())

        # --- NEW: Extract and format a readable name from the filename ---
        original_name = file.filename
        file_extension = os.path.splitext(original_name)[1].lower()
        display_name = os.path.splitext(original_name)[0].replace("_", " ").replace("-", " ").title()

        file_path = f"../data/raw_cvs/{cand_id}{file_extension}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Pass the extracted name to the model
        active_candidates[cand_id] = Candidate(
            id=cand_id,
            name=display_name,  # <--- Pass it here
            features=CandidateFeatures(),
            rf_score=0.0,
            user_score=0.0,
            risk_flag=False,
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


@app.websocket("/ws/candidates")
async def candidate_updates(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(1)
            updates = [c.model_dump(by_alias=True) for c in active_candidates.values()]
            await websocket.send_json({"candidates": updates})
    except Exception as e:
        print(f"WebSocket disconnected")

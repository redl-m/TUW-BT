from fastapi import FastAPI, UploadFile, File, WebSocket, BackgroundTasks
from typing import List, Dict
import asyncio
import uuid
import os
import shutil

from app.models.job import Job
from app.models.candidate import Candidate, CandidateFeatures
from app.services.parsers.cv_parser import CVParserService
from app.services.parsers.document_extractor import DocumentExtractor
from app.services.scorer import ScorerService
from app.services.interviewer import InterviewerService

app = FastAPI(title="Actionable Transparency in AI Recruitment")

# Ensure the raw_cvs directory exists
os.makedirs("../data/raw_cvs", exist_ok=True)

# In-Memory State & Queues
candidate_queue = asyncio.PriorityQueue()
active_candidates: Dict[str, Candidate] = {}
current_job_weights: Dict[str, float] = {}

# Initialize services
scorer = ScorerService()
cv_parser = CVParserService()
interviewer = InterviewerService(model=cv_parser.model, tokenizer=cv_parser.tokenizer)


async def process_queue():
    """Background worker that continuously processes the extraction & XAI queue."""
    while True:
        queue_item = await candidate_queue.get()

        # Handle different queue payloads based on length
        if len(queue_item) == 4:
            priority, task_type, candidate_id, file_path = queue_item
        else:
            priority, task_type, candidate_id = queue_item

        if task_type == "EXTRACT_CV":
            try:
                # Extract text from the saved file path
                raw_text = await DocumentExtractor.extract_text_from_path(file_path)

                # Parse into Pydantic model
                features = cv_parser.parse_cv(raw_text)

                # Update active candidate features
                active_candidates[candidate_id].features = features

                # Dual-Scoring Mechanism
                scores = scorer.evaluate_candidate(features, current_job_weights)
                active_candidates[candidate_id].rf_score = scores["rf_score"]
                active_candidates[candidate_id].user_score = scores["user_score"]
                active_candidates[candidate_id].risk_flag = scores["risk_flag"]
                active_candidates[candidate_id].shap_values = scores["shap_values"]

                # Push task to generate XAI
                await candidate_queue.put((2, "GENERATE_XAI", candidate_id))

            except Exception as e:
                print(f"Error processing CV for candidate {candidate_id}: {e}")

        elif task_type == "GENERATE_XAI":
            try:
                candidate = active_candidates[candidate_id]
                # Call the LLM generation
                summary, questions = interviewer.generate_narrative(candidate, current_job_weights)

                # Update the in-memory state
                active_candidates[candidate_id].executive_summary = summary
                active_candidates[candidate_id].interview_questions = questions

            except Exception as e:
                print(f"Error generating XAI narrative for candidate {candidate_id}: {e}")
                active_candidates[candidate_id].executive_summary = "Failed to generate narrative."
                active_candidates[candidate_id].interview_questions = []

        candidate_queue.task_done()


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(process_queue())


@app.post("/api/upload/job")
async def upload_job(file: UploadFile = File(...)):
    global current_job_weights
    current_job_weights = {"experienceYears": 0.8, "education": 0.5}
    return {"status": "Job processed, baseline weights set.", "weights": current_job_weights}


@app.post("/api/upload/cvs")
async def upload_cvs(files: List[UploadFile] = File(...)):
    responses = []
    for file in files:
        cand_id = str(uuid.uuid4())

        # Extract extension and create a safe local file path
        file_extension = os.path.splitext(file.filename)[1].lower()
        file_path = f"../data/raw_cvs/{cand_id}{file_extension}"

        # Save the file to disk immediately before the request closes
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Initialize empty candidate
        active_candidates[cand_id] = Candidate(id=cand_id, features=CandidateFeatures())

        # Pass the FILE PATH into the queue instead of the UploadFile object
        await candidate_queue.put((1, "EXTRACT_CV", cand_id, file_path))
        responses.append({"candidate_id": cand_id, "status": "queued"})

    return {"uploaded": responses}


@app.websocket("/ws/candidates")
async def candidate_updates(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(1)
            updates = [c.model_dump() for c in active_candidates.values()]
            await websocket.send_json({"candidates": updates})
    except Exception as e:
        print(f"WebSocket disconnected: {e}")
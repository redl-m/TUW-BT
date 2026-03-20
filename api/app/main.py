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

# Ensure the raw_cvs directory exists
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
                raw_text = await DocumentExtractor.extract_text_from_path(file_path)
                features = cv_parser.parse_cv(raw_text)

                print(f"\n--- CV EXTRACTED FOR {candidate_id[:8]} ---")
                print(f"Experience: {features.experienceYears} | Projects: {features.projectsCount}")
                print(f"Technical Skills: {features.technical_skills}")

                active_candidates[candidate_id].features = features

                scores = scorer.evaluate_candidate(features, current_job_weights)

                print(f"\n --- SCORES CALCULATED ---")
                print(f"RF AI Score: {scores['rf_score'] * 100:.2f}%")
                print(f"User Score: {scores['user_score'] * 100:.2f}%")

                active_candidates[candidate_id].rf_score = scores["rf_score"]
                active_candidates[candidate_id].user_score = scores["user_score"]
                active_candidates[candidate_id].risk_flag = scores["risk_flag"]
                active_candidates[candidate_id].shap_values = scores["shap_values"]

                await candidate_queue.put((2, "GENERATE_XAI", candidate_id))

            except Exception as e:

                print(f"❌ CRITICAL ERROR processing CV for {candidate_id}:")
                traceback.print_exc()

        elif task_type == "GENERATE_XAI":
            try:
                candidate = active_candidates[candidate_id]
                # Call the LLM generation
                summary, questions = interviewer.generate_narrative(candidate, current_job_weights)

                # Update the in-memory state
                active_candidates[candidate_id].executive_summary = summary
                active_candidates[candidate_id].interview_questions = questions

            except Exception as e:

                print(f"❌ CRITICAL ERROR generating XAI narrative for {candidate_id}:")
                traceback.print_exc()
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
            updates = [c.model_dump(by_alias=True) for c in active_candidates.values()]
            await websocket.send_json({"candidates": updates})
    except Exception as e:
        print(f"WebSocket disconnected: {e}")

# TODO: replace dummy funcion
@app.post("/api/evaluate")
async def evaluate_candidates(
        job_file: UploadFile = File(...),
        cv_files: List[UploadFile] = File(...)
):
    print(f"\n--- MOCK PIPELINE INITIATING (TEST MODE) ---")

    # Dummy Job Weights
    mock_job_weights = {
        "Experience (Years)": 4,
        "Projects Count": 3,
        "Structural Adherence": 3,
        "Adaptive Fluidity": 4,
        "Interpersonal Influence": 3,
        "Execution Velocity": 5,
        "Psychological Resilience": 4
    }

    # Generate Dummy Candidates

    # Candidate 1
    cand_1 = Candidate(
        id=str(uuid.uuid4()),
        features=CandidateFeatures(
            experienceYears=8,
            education="M.S. Computer Science",
            certifications="AWS Certified Solutions Architect",
            jobRole="Senior Software Engineer",
            projectsCount=14,
            jobHopping="Low",
            technical_skills=["Python", "Angular", "TypeScript", "FastAPI"],
            structuralAdherence=3,
            adaptiveFluidity=2,
            interpersonalInfluence=4,
            executionVelocity=4,
            psychologicalResilience=1
        ),
        rf_score=0.91,
        user_score=0.85,
        risk_flag=False,
        shap_values={
            "Adaptive Fluidity": 0.15,
            "Technical Skills": 0.10,
            "Experience (Years)": -0.12,
            "Job Hopping": -0.22,
            "Psychological Resilience": -0.10
        },
        executive_summary="Exceptional candidate with a proven track record of delivering high-velocity projects. Strong technical foundation and demonstrates high adaptive fluidity across different tech stacks. Displays strong company loyalty.",
        interview_questions=[
            "Can you walk us through the most complex system architecture you designed and maintained?",
            "How do you approach mentoring junior developers to improve their execution velocity?",
            "What strategies do you use to ensure structural adherence while working under tight deadlines?"
        ]
    )

    # Candidate 2
    cand_2 = Candidate(
        id=str(uuid.uuid4()),
        features=CandidateFeatures(
            experienceYears=2,
            education="B.S. Software Engineering",
            certifications="",
            jobRole="Frontend Developer",
            projectsCount=4,
            jobHopping="High",
            technical_skills=["JavaScript", "React", "HTML", "Tailwind"],
            structuralAdherence=5,
            adaptiveFluidity=2,
            interpersonalInfluence=2,
            executionVelocity=1,
            psychologicalResilience=4
        ),
        rf_score=0.62,
        user_score=0.75,
        risk_flag=True,  # trigger warning flag
        shap_values={
            "Experience (Years)": 0.25,
            "Projects Count": 0.18,
            "Execution Velocity": 0.12,
            "Job Hopping": 0.05,
            "Structural Adherence": -0.02
        },
        executive_summary="Promising junior developer with excellent adaptive skills and modern frontend framework knowledge. However, algorithmic risk flags were triggered due to a high job hopping frequency and lower psychological resilience markers in previous high-stress roles.",
        interview_questions=[
            "I noticed you have transitioned between several roles recently. What specific environment are you looking for to settle long-term?",
            "Describe a situation where a project requirements changed drastically at the last minute. How did you handle the stress?",
            "Can you share an example of a project where you had to quickly learn a completely new technology?"
        ]
    )

    print("Mock candidates generated! Returning to Angular UI...")

    # Return schema
    return { # Use by_alias=True to ensure the keys match Angular frontend
        "job_weights": mock_job_weights,
        "candidates": [
            cand_1.model_dump(by_alias=True),
            cand_2.model_dump(by_alias=True)
        ]
    }

"""
@app.post("/api/evaluate")
async def evaluate_candidates(
        job_file: UploadFile = File(...),
        cv_files: List[UploadFile] = File(...)
):
    global current_job_weights
    print(f"\n--- PIPELINE INITIATING ---")
    active_candidates.clear()

    # Phase 1: Process job description
    print(f"Phase 1: Processing Job Description ({job_file.filename})...")

    # Save the Job PDF temporarily
    job_id = str(uuid.uuid4())
    job_ext = os.path.splitext(job_file.filename)[1].lower()
    job_path = f"../data/raw_jobs/{job_id}{job_ext}"

    with open(job_path, "wb") as buffer:
        shutil.copyfileobj(job_file.file, buffer)

    try:
        # Extract raw text from the Job PDF
        job_text = await DocumentExtractor.extract_text_from_path(job_path)

        # Ask Llama 3.1 to extract the dynamic weights
        current_job_weights = job_parser.extract_baseline_weights(job_text)
        print(f"✅ Extracted Baseline Weights: {current_job_weights}")

    except Exception as e:
        print(f"❌ Failed to parse Job Description. Falling back to defaults. Error: {e}")
        traceback.print_exc()
        current_job_weights = {
            "Experience (Years)": 3, "Projects Count": 3, "Structural Adherence": 3,
            "Adaptive Fluidity": 3, "Interpersonal Influence": 3, "Execution Velocity": 3,
            "Psychological Resilience": 3
        }

    # Phase 2: Queue candidate CVs
    print(f"\n👥 Phase 2: Queuing {len(cv_files)} CVs for LLM Extraction...")

    for file in cv_files:
        cand_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1].lower()
        file_path = f"../data/raw_cvs/{cand_id}{file_extension}"

        # Save CV to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Initialize the empty stub for the UI
        active_candidates[cand_id] = Candidate(
            id=cand_id,
            features=CandidateFeatures(),
            rf_score=0.0,
            user_score=0.0,
            risk_flag=False,
            shap_values={},
            executive_summary="Processing AI narrative...",
            interview_questions=[]
        )

        # Throw into the background queue for asynchronous processing
        await candidate_queue.put((1, "EXTRACT_CV", cand_id, file_path))

    print("✅ All candidates queued! Returning stubs to Angular UI...")

    # Phase 3: Return to Angular
    return { # Use by_alias=True to ensure the keys match Angular frontend
        "job_weights": current_job_weights,
        "candidates": [c.model_dump(by_alias=True) for c in active_candidates.values()]
    }
"""
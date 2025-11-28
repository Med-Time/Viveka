from fastapi import APIRouter, HTTPException
from bson import ObjectId
from core.mongo import sessions_col, lesson_plan
from lesson_plan_module.core.mongo_fetch import fetch_lesson_plan
from interview_module.services.mongo_persistence import save_lesson_plan
from lesson_plan_module.langraph_flow.lesson_plan import xlesson_plan_graph
from core.mongo import generation_jobs
from datetime import datetime

from lesson_plan_module.core.generation import generate_and_save_lesson_plan

router = APIRouter(
    prefix="/lesson-plan",
    tags=["lesson-plan"]
)


@router.get("/generate/{study_id}")
async def generate_lesson_plan(study_id: str):
    """
    Generate a lesson plan for a specific session and save it to the database.
    Delegates to shared helper to keep behavior identical to worker.
    """
    lesson = lesson_plan.find_one({"study_id": study_id})
    if lesson:
        return fetch_lesson_plan(study_id)
    try:
        result = generate_and_save_lesson_plan(study_id)
        return result["response"]
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating lesson plan: {str(e)}")


@router.get("/{study_id}")
async def get_lesson_plan(study_id: str):
    """
    Retrieve the saved lesson plan for a specific session.
    """
    try:
        # Get the saved lesson plan
        lesson_plan = fetch_lesson_plan(study_id)
        
        if not lesson_plan:
            # Check if session exists
            session_exists = sessions_col.find_one({"_id": ObjectId(study_id)})
            
            if not session_exists:
                raise HTTPException(status_code=404, detail=f"Session {study_id} not found")
            else:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No lesson plan found for session {study_id}. Generate one first."
                )
        
        return lesson_plan
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving lesson plan: {str(e)}")



@router.post("/enqueue/{study_id}")
async def enqueue_lesson_plan(study_id: str):
    """
    Enqueue lesson plan generation job for the given study_id. Idempotent.
    """
    job_key = f"lesson_plan:{study_id}"

    existing = generation_jobs.find_one({"job_key": job_key, "type": "lesson_plan"})
    if existing and existing.get("status") in ("queued", "processing", "claimed", "partial", "ready"):
        existing["_id"] = str(existing["_id"])
        return {"job_id": str(existing["_id"]), "status": existing.get("status"), "job": existing}

    # create new job
    job_doc = {
        "job_key": job_key,
        "type": "lesson_plan",
        "params": {"study_id": study_id},
        "status": "queued",
        "progress": 0,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }
    res = generation_jobs.insert_one(job_doc)
    return {"job_id": str(res.inserted_id), "status": "queued"}


@router.get("/job/{job_id}")
async def get_job_status(job_id: str):
    try:
        job = generation_jobs.find_one({"_id": ObjectId(job_id)})
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        job["_id"] = str(job["_id"])
        return job
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

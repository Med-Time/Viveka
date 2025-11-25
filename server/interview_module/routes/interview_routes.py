from fastapi import APIRouter, Depends, HTTPException
from interview_module.models.schemas import InterviewStartInput, AnswerInput
from interview_module.langraph_flow.interview_graph import initial_question_graph, answer_loop_graph
from interview_module.services.session_state import init_state, load_state, save_state
from auth.services import get_current_user
from interview_module.services.mongo_persistence import (
    create_interview_session,
    save_qa,
    save_persona,
    save_study
)
from lesson_plan_module.core.mongo import sessions_col, persona_col, qa_col
from bson import ObjectId
from core.mongo import generation_jobs
from datetime import datetime

router = APIRouter()

@router.post("/start")
def start_interview(data: InterviewStartInput):
    # Create DB session
    study_id = create_interview_session(
        user_id=data.user_id,
        subject=data.subject,
        goal=data.goal,
        level=data.level,
    )

    # Create LangGraph state
    state = init_state(data)
    state["study_id"] = study_id
    
    # Use initial_question_graph to just get curriculum and first question
    result = initial_question_graph.invoke(state)
    
    # Process the result
    if isinstance(result, dict) and "state" in result:
        updated_state = result["state"]
    # elif hasattr(result, "state"):
    #     updated_state = result.state
    else:
        updated_state = result
    
    # Save session state
    save_state(data.user_id, updated_state)
    
    # Check if curriculum exists and has content
    if not updated_state.get("curriculum") or len(updated_state["curriculum"]) == 0:
        return {
            "status": "error",
            "message": "No curriculum was generated. Please try again.",
            "study_id": study_id
        }
    
    save_study(data.user_id, study_id, data.subject)
    
    # Return the first question
    return {
        "status": "ok",
        "type": updated_state.get("current_question_type"),
        "question": updated_state["current_question"],
        "concept": updated_state["curriculum"][0],  # Always first concept
        "study_id": study_id,
    }


@router.post("/answer")
def answer_question(data: AnswerInput):
    # Load session state
    state = load_state(data.user_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Add user answer
    state["answer"] = data.answer
    concept = state["curriculum"][state["current_concept_index"]]
    
    # Use answer_loop_graph which starts from scoring
    result = answer_loop_graph.invoke(state)
    
    # Process result
    if isinstance(result, dict) and "state" in result:
        updated_state = result["state"]
    # elif hasattr(result, "state"):
    #     updated_state = result.state
    else:
        updated_state = result
        
    save_state(data.user_id, updated_state)

    # Save Q/A to MongoDB
    save_qa(
        session_id=updated_state["study_id"],
        concept=concept,
        feedback=updated_state["feedback_history"],
        question=updated_state["current_question"],
        answer=updated_state["answer"],
        score=updated_state["score_history"][-1],
        retry=updated_state["retry_count"],
    )

    # If finished, save persona report and return summary
    if updated_state.get("done", False):
        save_persona(
            session_id=updated_state["study_id"],
            report_text=updated_state.get("persona_summary", ""),
            type="interview",
            #feedback=updated_state["feedback_history"],
        )
        # Enqueue lesson-plan generation in background (idempotent)
        try:
            study_id = updated_state.get("study_id")
            job_key = f"lesson_plan:{study_id}"
            existing = generation_jobs.find_one({"job_key": job_key, "type": "lesson_plan"})
            if not existing:
                generation_jobs.insert_one({
                    "job_key": job_key,
                    "type": "lesson_plan",
                    "params": {"study_id": study_id},
                    "status": "queued",
                    "progress": 0,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                })
        except Exception:
            # Don't let enqueue errors affect interview response
            pass
        # Enqueue generation of first subtopic content
        try:
            study_id = updated_state.get("study_id")
            job_key = f"content:{study_id}:0:0"
            existing = generation_jobs.find_one({"job_key": job_key, "type": "content"})
            if not existing:
                generation_jobs.insert_one({
                    "job_key": job_key,
                    "type": "content",
                    "params": {"study_id": study_id, "chapter_idx": 0, "subtopic_idx": 0},
                    "status": "queued",
                    "progress": 0,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                })
        except Exception:
            # Don't let enqueue errors affect interview response
            pass
        return {
            "status": "done",
            "final_score": sum(updated_state["score_history"]) // len(updated_state["score_history"]),
            "summary": updated_state.get("persona_summary", ""),
            "feedback": updated_state.get("feedback_history")

        }

    # Else, return next question
    return {
        "status": "ok",
        "study_id": updated_state["study_id"],
        "type": updated_state.get("current_question_type"),
        "question": updated_state["current_question"],
        "concept": updated_state["curriculum"][updated_state["current_concept_index"]],
        "score": updated_state["score_history"][-1],
        "feedback": updated_state.get("feedback_history", [])[-1] if updated_state.get("feedback_history") else None,
    }


@router.get("/persona/{study_id}")
def get_persona_report(study_id: str):
    """
    Retrieve the persona report for a specific session.
    
    Args:
        study_id: The ID of the session to get the persona report for
        
    Returns:
        The persona report document as JSON
    """
    try:
        # Convert string ID to ObjectId if needed
        session_obj_id = study_id
        if ObjectId.is_valid(study_id):
            session_obj_id = ObjectId(study_id)
        
        # Find the most recent persona report for this session
        persona_report = persona_col.find_one(
            {"study_id": study_id},
            sort=[("created_at", -1)]
        )
        
        # Check if persona report exists
        if not persona_report:
            raise HTTPException(status_code=404, detail=f"No persona report found for session {study_id}")
        
        # Convert ObjectId to string for JSON serialization
        if "_id" in persona_report:
            persona_report["_id"] = str(persona_report["_id"])
            
        return {
            "status": "success",
            "data": persona_report
        }
        
    except Exception as e:
        # Handle other errors
        raise HTTPException(status_code=500, detail=f"Error retrieving persona report: {str(e)}")


@router.post("/finish/{study_id}")
async def finish_interview(study_id: str):
    """
    Called when user finishes interview/session.
    Enqueue lesson-plan generation job (idempotent) and return quickly.
    """
    try:
        # Do existing finish work (save interview results, persona, etc.)
        # ...existing code...

        # Enqueue lesson-plan generation job idempotently
        job_key = f"lesson_plan:{study_id}"
        existing = generation_jobs.find_one({"job_key": job_key, "type": "lesson_plan"})
        if not existing:
            now = datetime.utcnow()
            generation_jobs.insert_one({
                "job_key": job_key,
                "type": "lesson_plan",
                "params": {"study_id": study_id},
                "status": "queued",
                "progress": 0,
                "created_at": now,
                "updated_at": now,
            })
        # Return quickly to caller; generation proceeds in background
        return {"status": "ok", "enqueued_lesson_plan": True}
    except Exception as e:
        # do not block client on enqueue errors - surface an info-level failure
        return {"status": "ok", "enqueued_lesson_plan": False, "error": str(e)}
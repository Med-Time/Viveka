from fastapi import APIRouter, HTTPException
from interview_module.models.schemas import InterviewStartInput, AnswerInput
from interview_module.langraph_flow.interview_graph import initial_question_graph, answer_loop_graph
from interview_module.services.session_state import init_state, load_state, save_state
from interview_module.services.mongo_persistence import (
    create_interview_session,
    save_qa,
    save_persona,
    
)
from lesson_plan_module.core.mongo import sessions_col, persona_col, qa_col
from bson import ObjectId

router = APIRouter()

@router.post("/interview/start")
def start_interview(data: InterviewStartInput):
    # Create DB session
    session_id = create_interview_session(
        user_id=data.user_id,
        subject=data.subject,
        goal=data.goal,
        level=data.level,
    )

    # Create LangGraph state
    state = init_state(data)
    state["session_id"] = session_id
    
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
            "session_id": session_id
        }
    
    # Return the first question
    return {
        "status": "ok",
        "question": updated_state["current_question"],
        "concept": updated_state["curriculum"][0],  # Always first concept
        "session_id": session_id,
    }


@router.post("/interview/answer")
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
        session_id=updated_state["session_id"],
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
            session_id=updated_state["user_id"],
            report_text=updated_state.get("persona_summary", ""),
            type="interview",
            #feedback=updated_state["feedback_history"],
        )
        return {
            "status": "done",
            "final_score": sum(updated_state["score_history"]) // len(updated_state["score_history"]),
            "summary": updated_state.get("persona_summary", ""),
            "feedback": updated_state.get("feedback_history")

        }

    # Else, return next question
    return {
        "status": "ok",
        "question": updated_state["current_question"],
        "concept": updated_state["curriculum"][updated_state["current_concept_index"]],
        "score": updated_state["score_history"][-1]
    }


@router.get("/persona/{session_id}")
def get_persona_report(session_id: str):
    """
    Retrieve the persona report for a specific session.
    
    Args:
        session_id: The ID of the session to get the persona report for
        
    Returns:
        The persona report document as JSON
    """
    try:
        # Convert string ID to ObjectId if needed
        session_obj_id = session_id
        if ObjectId.is_valid(session_id):
            session_obj_id = ObjectId(session_id)
        
        # Find the most recent persona report for this session
        persona_report = persona_col.find_one(
            {"session_id": session_id},
            sort=[("created_at", -1)]
        )
        
        # Check if persona report exists
        if not persona_report:
            raise HTTPException(status_code=404, detail=f"No persona report found for session {session_id}")
        
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
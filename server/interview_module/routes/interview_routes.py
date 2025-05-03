from fastapi import APIRouter, HTTPException
from models.schemas import InterviewStartInput, AnswerInput
#from ..langraph_flow.interview_graph import interview_graph
from langraph_flow.interview_graph import interview_graph
#from ..langgraph_flow.interview_graph import interview_graph
from services.session_state import init_state, load_state, save_state
from services.mongo_persistence import (
    create_interview_session,
    save_qa,
    save_persona,
)


#from server.interview_module
# from .langgraph_flow.interview_graph import interview_graph
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

    # Start LangGraph
    result = interview_graph.invoke(state)
    updated_state = result["state"]

    # Save session state
    save_state(data.user_id, updated_state)

    return {
        "status": "ok",
        "question": updated_state["current_question"],
        "concept": updated_state["curriculum"][updated_state["current_concept_index"]],
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

    # Resume LangGraph
    result = interview_graph.invoke(state)
    updated_state = result["state"]
    save_state(data.user_id, updated_state)

    # Save Q/A to MongoDB
    save_qa(
        session_id=updated_state["session_id"],
        concept=concept,
        question=updated_state["current_question"],
        answer=updated_state["answer"],
        score=updated_state["score_history"][-1],
        retry=updated_state["retry_count"],
    )

    # If finished, save persona report and return summary
    if updated_state.get("done", False):
        save_persona(
            user_id=updated_state["user_id"],
            report_text=updated_state.get("persona_summary", ""),
            type="interview"
        )
        return {
            "status": "done",
            "final_score": sum(updated_state["score_history"]) // len(updated_state["score_history"]),
            "summary": updated_state.get("persona_summary", "")
        }

    # Else, return next question
    return {
        "status": "ok",
        "question": updated_state["current_question"],
        "concept": updated_state["curriculum"][updated_state["current_concept_index"]],
        "score": updated_state["score_history"][-1]
    }

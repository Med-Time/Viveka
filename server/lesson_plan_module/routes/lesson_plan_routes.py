from fastapi import APIRouter, HTTPException
from bson import ObjectId
from lesson_plan_module.core.mongo import sessions_col, persona_col, qa_col
from lesson_plan_module.langraph_flow.lesson_plan import generate_lesson_plan ,xlesson_plan_graph
router = APIRouter(
    prefix="/lesson-plan",
    tags=["lesson-plan"]
)

@router.get("/")
def get_lesson_plans():
    return {"message": "Lesson plans endpoint"}

@router.post("/generate")
def generate_lesson_plan():
    return {"message": "Lesson plan generation endpoint"}

@router.get("generate/{session_id}")
async def get_lesson_plan(session_id: str):
    # 1. Get session data
    try:
        session_data = sessions_col.find_one({"_id": ObjectId(session_id)})
        if not session_data:
            raise HTTPException(status_code=404, detail=f"Session not found")
        session_data["_id"] = str(session_data["_id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid session ID")

    # 2. Get persona report
    try:
        persona_report = persona_col.find_one(
            {"session_id": session_id},
            sort=[("created_at", -1)]
        )
        if not persona_report:
            raise HTTPException(status_code=404, detail="No persona report found")
        if "_id" in persona_report:
            persona_report["_id"] = str(persona_report["_id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error retrieving persona report")

    # 3. Get Q&A and feedback history
    try:
        qa_history = list(qa_col.find(
            {"session_id": session_id},
            {
                "concept": 1,
                "question": 1,
                "answer": 1,
                "feedback": 1,
                "score": 1,
                "_id": 1
            }
        ).sort("created_at", 1))
        # Convert ObjectId to string for each qa_history item
        for qa in qa_history:
            if "_id" in qa:
                qa["_id"] = str(qa["_id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error retrieving Q&A history")

    state  = {
        "session_id": session_id,
        "user_id": session_data.get("user_id"),
        "subject": session_data.get("subject"),
        "goal": session_data.get("goal"),
        "level": session_data.get("level"),
        "persona_report": persona_report,
        "feedback_history": qa_history,
        "taken_test_curriculum": session_data.get("curriculum", [])
    }

    result  = xlesson_plan_graph.invoke(state)
    print(result)
    

    # 4. Construct lesson plan
    return {
        "session_id": session_id,
        "user_id": session_data.get("user_id"),
        "subject": session_data.get("subject"),
        "goal": session_data.get("goal"),
        "level": session_data.get("level"),
        "lesson_plan": result.get("lesson_plan"),  # Add the actual lesson plan
        "grade": result.get("grade"),              # Add the grade
        "feedback": result.get("feedback"),        # Add the feedback
        "persona_report": persona_report,
        "qa_feedback_history": qa_history,
        "curriculum_generated": session_data.get("curriculum", [])
    }
    
from fastapi import APIRouter, HTTPException
from bson import ObjectId
from lesson_plan_module.core.mongo import sessions_col, persona_col, qa_col
from lesson_plan_module.core.mongo_fetch import fetch_lesson_plan
from interview_module.services.mongo_persistence import save_lesson_plan
from lesson_plan_module.langraph_flow.lesson_plan import xlesson_plan_graph
from datetime import datetime

router = APIRouter(
    prefix="/lesson-plan",
    tags=["lesson-plan"]
)


@router.get("/generate/{session_id}")
async def generate_lesson_plan(session_id: str):
    """
    Generate a lesson plan for a specific session and save it to the database.
    """
    # 1. Get session data
    try:
        session_data = sessions_col.find_one({"_id": ObjectId(session_id)})
        if not session_data:
            raise HTTPException(status_code=404, detail=f"Session not found")
        session_data["_id"] = str(session_data["_id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid session ID: {str(e)}")

    # 2. Get persona report
    try:
        persona_report = persona_col.find_one(
            {"session_id": session_id},
            sort=[("created_at", -1)]
        )
        if not persona_report:
            raise HTTPException(status_code=404, detail="No persona report found")
        persona_report_id = str(persona_report["_id"])
        persona_report["_id"] = persona_report_id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving persona report: {str(e)}")

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
        
        # Convert ObjectId to string for each item
        for qa in qa_history:
            if "_id" in qa:
                qa["_id"] = str(qa["_id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving Q&A history: {str(e)}")

    # 4. Prepare state for lesson plan generation
    state = {
        "session_id": session_id,
        "user_id": session_data.get("user_id"),
        "subject": session_data.get("subject"),
        "goal": session_data.get("goal"),
        "level": session_data.get("level"),
        "persona_report": persona_report,
        "feedback_history": qa_history,
        "taken_test_curriculum": session_data.get("curriculum", [])
    }

    # 5. Generate lesson plan
    try:
        result = xlesson_plan_graph.invoke(state)
        
        # 6. Prepare response data
        lesson_plan = result.get("lesson_plan")
        lesson_plan_dict = None

        if lesson_plan:
            # Convert Pydantic model to dict for MongoDB storage
            try:
                # First try the model_dump method (Pydantic v2)
                if hasattr(lesson_plan, "model_dump"):
                    lesson_plan_dict = lesson_plan.model_dump()
                # Fall back to dict() for Pydantic v1k
                else:
                    lesson_plan_dict = lesson_plan.dict()
            except Exception as e:
                # If conversion fails, use a string representation
                lesson_plan_dict = {
                    "raw_plan": str(lesson_plan),
                    "conversion_error": str(e)
                }

        response_data = {
            "session_id": session_id,
            "user_id": session_data.get("user_id"),
            "subject": session_data.get("subject"),
            "goal": session_data.get("goal"),
            "level": session_data.get("level"),
            "lesson_plan": lesson_plan_dict,  # Use the converted dict
            "grade": result.get("grade"),
            "feedback": result.get("feedback"),
            "persona_report_id": persona_report_id,
            "qa_history_ids": [qa["_id"] for qa in qa_history if "_id" in qa],
            "curriculum_generated": session_data.get("curriculum", []),
        }
        
        # 7. Save lesson plan to MongoDB
        try:
            lesson_plan_id = save_lesson_plan(session_id, response_data)
            response_data["lesson_plan_id"] = lesson_plan_id
            print(f"✅ Lesson plan saved with ID: {lesson_plan_id}")
        except Exception as e:
            print(f"❌ Error saving lesson plan: {str(e)}")
            # Continue even if save fails
            response_data["save_error"] = str(e)
            
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating lesson plan: {str(e)}")


@router.get("/{session_id}")
async def get_lesson_plan(session_id: str):
    """
    Retrieve the saved lesson plan for a specific session.
    """
    try:
        # Get the saved lesson plan
        lesson_plan = fetch_lesson_plan(session_id)
        
        if not lesson_plan:
            # Check if session exists
            session_exists = sessions_col.find_one({"_id": ObjectId(session_id)})
            
            if not session_exists:
                raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
            else:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No lesson plan found for session {session_id}. Generate one first."
                )
        
        return {
            "status": "success",
            "data": lesson_plan
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving lesson plan: {str(e)}")

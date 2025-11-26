from datetime import datetime
from bson import ObjectId

from lesson_plan_module.core.mongo import sessions_col, persona_col, qa_col
from lesson_plan_module.langraph_flow.lesson_plan import xlesson_plan_graph
from interview_module.services.mongo_persistence import save_lesson_plan


def generate_and_save_lesson_plan(study_id: str):
    """
    Generate lesson plan for study_id using the existing graph and persist it.
    Returns a dict with lesson_plan_id and saved response.
    Raises ValueError on missing session or RuntimeError on failures.
    """
    # validate session
    try:
        session_data = sessions_col.find_one({"_id": ObjectId(study_id)})
    except Exception as e:
        raise ValueError(f"Invalid session ID: {e}")

    if not session_data:
        raise ValueError("study not found")

    # persona
    persona_report = persona_col.find_one({"study_id": study_id}, sort=[("created_at", -1)])
    persona_report_id = str(persona_report["_id"]) if persona_report and "_id" in persona_report else None

    # qa history
    qa_history = list(qa_col.find({"study_id": study_id}, {"concept":1,"question":1,"answer":1,"feedback":1,"score":1,"_id":1}).sort("created_at", 1))
    for qa in qa_history:
        if "_id" in qa:
            qa["_id"] = str(qa["_id"])

    # prepare state
    state = {
        "study_id": study_id,
        "user_id": session_data.get("user_id"),
        "subject": session_data.get("subject"),
        "goal": session_data.get("goal"),
        "level": session_data.get("level"),
        "persona_report": persona_report,
        "feedback_history": qa_history,
        "taken_test_curriculum": session_data.get("curriculum", []),
    }

    # invoke generator
    result = xlesson_plan_graph.invoke(state)

    lesson_plan = result.get("lesson_plan")
    try:
        if hasattr(lesson_plan, "model_dump"):
            lesson_plan_dict = lesson_plan.model_dump()
        else:
            lesson_plan_dict = lesson_plan.dict()
    except Exception:
        lesson_plan_dict = {"raw_plan": str(lesson_plan)}

    response_data = {
        "study_id": study_id,
        "user_id": session_data.get("user_id"),
        "subject": session_data.get("subject"),
        "goal": session_data.get("goal"),
        "level": session_data.get("level"),
        "lesson_plan": lesson_plan_dict,
        "grade": result.get("grade"),
        "feedback": result.get("feedback"),
        "persona_report_id": persona_report_id,
        "qa_history_ids": [qa["_id"] for qa in qa_history if "_id" in qa],
        "curriculum_generated": session_data.get("curriculum", []),
        "generated_at": datetime.now().isoformat(),
    }

    # persist
    lp_id = save_lesson_plan(study_id, response_data)
    response_data["lesson_plan_id"] = lp_id
    return {"lesson_plan_id": lp_id, "response": response_data}
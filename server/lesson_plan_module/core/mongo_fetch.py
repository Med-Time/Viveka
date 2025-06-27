# core/mongo_fetch.py

from interview_module.core.mongo import sessions_col, qa_col, persona_col
from bson.objectid import ObjectId

def fetch_session_details(session_id: str):
    """
    Fetches subject, goal, and level for a given session ID.
    """
    session = sessions_col.find_one({"_id": ObjectId(session_id)})
    if session:
        return {
            "subject": session.get("subject"),
            "goal": session.get("goal"),
            "level": session.get("level")
        }
    return None

def fetch_curriculum_generated(session_id: str):
    """
    Fetches the curriculum generated for a given session ID.
    Note: The curriculum is stored within the 'sessions_col' document itself,
    as observed in the workflow output (`output till persona RAW.txt`).
    """
    session = sessions_col.find_one({"_id": ObjectId(session_id)})
    if session and "curriculum" in session:
        return session.get("curriculum")
    return []

def fetch_feedback_history(session_id: str):
    """
    Fetches the feedback history (questions, answers, scores, feedback)
    for a given session ID.
    """
    # Assuming feedback, questions, answers, and scores are stored together
    # in qa_col, as implied by score.py where all are appended.
    feedback_entries = qa_col.find({"session_id": session_id}).sort("created_at", 1)
    
    history = []
    for entry in feedback_entries:
        history.append({
            "question": entry.get("question"),
            "answer": entry.get("answer"),
            "score": entry.get("score"),
            "feedback": entry.get("feedback"), # Assuming 'feedback' field exists
            "retry_count": entry.get("retry_count")
        })
    return history

def fetch_persona_summary(user_id: str):
    """
    Fetches the latest persona summary for a given user ID.
    """
    # Assuming the persona is saved per user and you want the latest one
    persona = persona_col.find_one({"user_id": user_id}, sort=[("created_at", -1)])
    if persona:
        # Exclude MongoDB's internal '_id' field if not needed in the output
        persona.pop("_id", None)
        return persona
    return None

def fetch_all_session_data(session_id: str, user_id: str):
    """
    Fetches all requested modular data for a given session and user ID.
    """
    session_details = fetch_session_details(session_id)
    curriculum = fetch_curriculum_generated(session_id)
    feedback_history = fetch_feedback_history(session_id)
    persona_summary = fetch_persona_summary(user_id) # Persona is tied to user_id, not session_id directly in save_persona

    return {
        "session_details": session_details,
        "curriculum_generated": curriculum,
        "feedback_history": feedback_history,
        "persona_summary": persona_summary
    }

def fetch_lesson_plan(session_id: str):
    """
    Fetches the saved lesson plan for a given session ID.
    """
    # Get the lesson_plans collection (use plural)
    lesson_plans_col = sessions_col.database.lesson_plans
    
    # Find the lesson plan for this session
    lesson_plan = lesson_plans_col.find_one({"session_id": session_id})
    
    if lesson_plan:
        # Convert ObjectId to string for JSON serialization
        lesson_plan["_id"] = str(lesson_plan["_id"])
        
        # Convert datetime objects to strings
        if "created_at" in lesson_plan:
            lesson_plan["created_at"] = lesson_plan["created_at"].isoformat()
            
    return lesson_plan
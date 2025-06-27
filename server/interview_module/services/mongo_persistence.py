from interview_module.core.mongo import sessions_col, qa_col, persona_col, lesson_plan
from datetime import datetime
from bson import ObjectId

def create_interview_session(user_id, subject, goal, level,curriculum=None):
    session = {
        "user_id": user_id,
        "subject": subject,
        "goal": goal,
        "level": level,
        "created_at": datetime.utcnow()
    }
    if curriculum:
        session["curriculum"] = curriculum 
    result = sessions_col.insert_one(session)
    return str(result.inserted_id)

def save_qa(session_id,feedback, concept, question, answer, score, retry):
    qa_col.insert_one({
        "session_id": session_id,
        "concept": concept,
        "question": question,
        "answer": answer,
        "feedback_history": feedback,  # Placeholder for feedback
        "score": score,
        "retry_count": retry,
        "created_at": datetime.utcnow()
    })

def save_persona(session_id, report_text, type="interview"):
    # Create a base document
    persona_doc = {
        "session_id": session_id,
        "type": type,
        "created_at": datetime.utcnow()
    }
    
    # Handle different types of report_text input
    if hasattr(report_text, 'model_dump'):  # Pydantic v2
        # Add each field from the PersonaSummary as a top-level field
        print("Using Pydantic v2 model_dump")
        persona_doc.update(report_text.model_dump())
    elif hasattr(report_text, 'dict'): 
        print("dict way\n\n")    # Pydantic v1
        persona_doc.update(report_text.dict())
    else:
        # Just a basic string or object, use as is
        print("Using basic string or object")
        persona_doc["report_text"] = report_text
    
    # Save to MongoDB
    persona_col.insert_one(persona_doc)

def get_persona_report(user_id, type="interview"):
    return persona_col.find_one({"user_id": user_id, "type": type}, {"_id": 0})

def save_curriculum(session_id, curriculum_list):
    """
    Saves the generated curriculum to an existing session.
    """
    sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"curriculum": curriculum_list}}
    )
    print(f"Curriculum saved for session {session_id}")

def save_lesson_plan(session_id, lesson_plan_data):
    """
    Saves the generated lesson plan and associated data.
    """
    try:
        # Create a new document for the lesson plan
        lesson_plan_doc = {
            "session_id": session_id,
            "created_at": datetime.utcnow()
        }
        
        # Add all the data from lesson_plan_data
        lesson_plan_doc.update(lesson_plan_data)
        
        # Get the correct collection - use lesson_plans (plural)
        lesson_plans_col = sessions_col.database.lesson_plans
        
        # Check if a lesson plan for this session already exists
        existing_plan = lesson_plans_col.find_one({"session_id": session_id})
        
        if existing_plan:
            # Update existing plan
            result = lesson_plans_col.update_one(
                {"session_id": session_id},
                {"$set": lesson_plan_doc}
            )
            return str(existing_plan["_id"])
        else:
            # Insert new plan
            result = lesson_plans_col.insert_one(lesson_plan_doc)
            return str(result.inserted_id)
    except Exception as e:
        print(f"Exception in save_lesson_plan: {str(e)}")
        raise


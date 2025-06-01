from interview_module.core.mongo import sessions_col, qa_col, persona_col
from datetime import datetime
#from bson import ObjectId

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


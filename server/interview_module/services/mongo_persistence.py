from core.mongo import sessions_col, qa_col, persona_col
from datetime import datetime

def create_interview_session(user_id, subject, goal, level):
    session = {
        "user_id": user_id,
        "subject": subject,
        "goal": goal,
        "level": level,
        "created_at": datetime.utcnow()
    }
    result = sessions_col.insert_one(session)
    return str(result.inserted_id)

def save_qa(session_id, concept, question, answer, score, retry):
    qa_col.insert_one({
        "session_id": session_id,
        "concept": concept,
        "question": question,
        "answer": answer,
        "score": score,
        "retry_count": retry,
        "created_at": datetime.utcnow()
    })

def save_persona(user_id, report_text, type="interview"):
    persona_col.insert_one({
        "user_id": user_id,
        "type": type,
        "report_text": report_text,
        "created_at": datetime.utcnow()
    })

def get_persona_report(user_id, type="interview"):
    return persona_col.find_one({"user_id": user_id, "type": type}, {"_id": 0})

_sessions = {}

def init_state(data):
    return {
        "user_id": data.user_id,
        "subject": data.subject,
        "goal": data.goal,
        "level": data.level,
        "curriculum": [],
        "current_concept_index": 0,
        "current_question": "",
        "question_history": [],
        "answer_history": [],
        "score_history": [],
        "retry_count": 0,
        "use_rag": False,
        "done": False,
        "feedback_history": [],
    }

def save_state(user_id, state):
    _sessions[user_id] = state

def load_state(user_id):
    return _sessions.get(user_id)

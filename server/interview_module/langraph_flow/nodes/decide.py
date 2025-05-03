def decide_next(state):
    score = state["score_history"][-1]
    
    if score >= 80:
        state["current_concept_index"] += 1
        state["retry_count"] = 0
    else:
        state["retry_count"] += 1
    
    if state["retry_count"] >= 3:
        state["current_concept_index"] += 1
        state["retry_count"] = 0

    if state["current_concept_index"] >= len(state["curriculum"]):
        state["done"] = True
    
    return state

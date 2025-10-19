def validate_content_node(state):
    """
    Validate the generated content.
    Could be another LLM call, heuristic, or simple keyword check.
    """
    try:
        # Placeholder validation (replace with LLM evaluator)
        if state.generated_content and all(len(v) > 50 for v in state.generated_content.values()):
            state.grade = "Good"
            state.next_step = "valid"
        else:
            state.grade = "Bad"
            state.feedback = "Content too short or missing."
            state.next_step = "retry"

        return state

    except Exception as e:
        state.error = str(e)
        state.next_step = "retry"
        return state

def generate_curriculum_rag(state):
    # Assume retrieved chunks already contain `chapter` or `topic` metadata
    # We'll just simulate a sample set for now
    state["curriculum"] = [
        "Memory Management", "Paging", "File Systems", "Concurrency", "Scheduling"
    ]
    return state

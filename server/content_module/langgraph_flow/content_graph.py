from langgraph.graph import StateGraph, END
from content_module.langgraph_flow.nodes.content_generator import generate_content_node
from content_module.langgraph_flow.nodes.content_evaluator import validate_content_node
from content_module.schemas import ContentInput
from content_module.langgraph_flow.nodes.image_agent import fetch_images_node


# ---------------- Routing Helper ----------------
def route_after_validation(state):
    """
    Decide what to do after content validation.
    - If grade == "Good" → route to 'valid'
    - If grade == "Bad" but retry_count < limit → route to 'retry'
    - Otherwise → route to 'stop'
    """
    print(f"[Router] Routing decision for grade: {getattr(state, 'content_grade', 'unknown')}")

    if getattr(state, "error", None):
        print(f"[Router] Error detected in state: {state.error}")
        return "retry"

    grade = getattr(state, "content_grade", "Bad")
    retry_count = getattr(state, "retry_count", 0)
    max_retries = getattr(state, "max_retries", 2)  # configurable default

    if grade == "Good":
        print("[Router] ✅ Content validated successfully. Routing → END.")
        return "valid"

    if retry_count < max_retries:
        print(f"[Router] 🔁 Content grade '{grade}', retrying ({retry_count}/{max_retries})")
        return "retry"

    print("[Router] ❌ Max retries reached or persistent Bad grade. Routing → stop.")
    return "stop"


# ---------------- Retry Node ----------------
def check_retry_limit(state):
    """
    Checks whether the retry limit is reached.
    Returns one of:
    - "continue" → proceed to regenerate content
    - "stop" → halt process
    """
    retry_count = getattr(state, "retry_count", 0)
    max_retries = getattr(state, "max_retries", 2)

    print(f"[RetryCheck] Current retry count: {retry_count}/{max_retries}")

    if retry_count < max_retries:
        return "continue"
    else:
        print("[RetryCheck] ⚠️ Retry limit reached. Ending flow.")
        return "stop"


# ---------- Graph Definition ---------- #
def content_graph():
    builder = StateGraph(ContentInput)

    # Nodes
    builder.add_node("GenerateContent", generate_content_node)
    builder.add_node("ValidateContent", validate_content_node)
    builder.add_node("CheckRetries", check_retry_limit)
    builder.add_node("fetch_images", fetch_images_node)
    # Entry
    builder.set_entry_point("GenerateContent")
    builder.add_edge("GenerateContent", "fetch_images") # Generate -> Fetch
    builder.add_edge("fetch_images", "ValidateContent") 
    # Fetch -> Evaluate
    # Edges
    # builder.add_edge("GenerateContent", "ValidateContent")

    builder.add_conditional_edges(
        "ValidateContent",
        route_after_validation,
        {
            "valid": END,
            "retry": "CheckRetries",
            "stop": END,
        },
    )

    builder.add_conditional_edges(
        "CheckRetries",
        check_retry_limit,
        {
            "continue": "GenerateContent",
            "stop": END,
        },
    )
    # builder.add_edge("fetch_images", END)

    return builder.compile()


# Compile once globally
graph = content_graph()

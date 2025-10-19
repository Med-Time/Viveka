from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, Literal
from content_module.langgraph_flow.nodes.content_generator import generate_content_node
from content_module.langgraph_flow.nodes.content_evaluator import validate_content_node

# Define maximum retries for content generation
MAX_RETRIES = 3


class ContentInput(BaseModel):
    session_id: str = Field(..., description="The session/user ID")
    chapter_idx: int = Field(..., description="Index of the chapter to generate content for")

    # Generated content (output of content generator)
    generated_content: Optional[Dict[Any, Any]] = Field(
        None, description="Dictionary of subtopic_title -> generated content"
    )

    # Evaluation results
    grade: Optional[Literal["Good", "Bad"]] = Field(
        None, description="The grade of the generated content"
    )
    feedback: Optional[str] = Field(None, description="Feedback on generated content")
    evaluation_metrics: Optional[Dict[str, Dict[str, Any]]] = Field(
        None, description="Detailed metrics for evaluation"
    )
    next_step: Optional[str] = Field(
        None, description="Next step in the workflow (valid/retry)"
    )

    # Error handling
    error: Optional[str] = Field(None, description="Error message if any failure")

    # Retry counter
    retry_count: int = Field(0, description="Counter for retry attempts")


# ---------- Helper functions for routing ---------- #

def check_retry_limit(state: ContentInput):
    """Check if we've reached the maximum number of retries."""
    if not state.feedback:
        state.feedback = ""

    state.feedback += f"\n\nRetry attempt {state.retry_count}/{MAX_RETRIES}."
    return state


def route_after_validation(state: ContentInput):
    """Decide whether to accept or retry based on grade."""
    return state.next_step if state.next_step else "retry"


def check_retry_status(state: ContentInput):
    """Decide whether to retry again or stop."""
    if state.retry_count < MAX_RETRIES:
        return "continue"
    else:
        if not state.feedback:
            state.feedback = ""
        state.feedback += f"\n\nMaximum retry attempts ({MAX_RETRIES}) reached. Returning best available content."
        return "stop"


# ---------- Graph Definition ---------- #

def content_graph():
    builder = StateGraph(ContentInput)

    # Add nodes
    builder.add_node("GenerateContent", generate_content_node)
    # builder.add_node("ValidateContent", validate_content_node)
    # builder.add_node("CheckRetries", check_retry_limit)

    # Entry point
    builder.set_entry_point("GenerateContent")

    # Edges
    # builder.add_edge("GenerateContent", "ValidateContent")

    # builder.add_conditional_edges(
    #     "ValidateContent",
    #     route_after_validation,
    #     {
    #         "valid": END,
    #         "retry": "CheckRetries",
    #     },
    # )

    # builder.add_conditional_edges(
    #     "CheckRetries",
    #     check_retry_status,
    #     {
    #         "continue": "GenerateContent",
    #         "stop": END,
    #     },
    # )

    return builder.compile()


# Compiled graph object
graph = content_graph()

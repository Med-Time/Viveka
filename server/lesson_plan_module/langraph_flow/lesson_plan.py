from langgraph.graph import StateGraph, END
# Ensure these imports point to your files
from lesson_plan_module.langraph_flow.nodes.lesson_plan_generator import generate_lesson_plan
from lesson_plan_module.langraph_flow.nodes.lesson_plan_evaluator import validate_lesson_plan 

from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any, Union

# Define maximum retries as a constant
MAX_RETRIES = 3  # Must match the value in lesson_plan_evaluator.py

class LessonPlanInput(BaseModel):
    subject: str = Field(..., description="The subject user wants to study")
    goal: str = Field(..., description="The main goal user wants to achieve by studying the subject")
    level: str = Field(..., description="The level of the subject (e.g., beginner, intermediate, advanced)")
    taken_test_curriculum: Optional[Union[str, List[str]]] = Field(None, description="The curriculum the user has already given it's interview as, if any")
    #feedback_history: Optional[List[Dict[str, Any]]] = Field(None, description="Feedback history from previous lessons, if any")
    persona_report: Optional[Union[str, Dict[str, Any]]] = Field(None, description="Summary of the user's persona, if available")
    
    # Lesson Plan output from generator
    lesson_plan: Optional[Any] = Field(None, description="The generated structured lesson plan") 
    
    # Evaluation results from evaluator
    grade: Optional[Literal["Good","Bad"]] = Field(None, description="The grade of the Lesson Plan")
    feedback: Optional[str] = Field(None, description="Feedback on the lesson plan")
    evaluation_metrics: Optional[Dict[str, Dict[str, Any]]] = Field(None, description="Detailed metrics for each evaluation criterion")
    next_step: Optional[str] = Field(None, description="Next step in the workflow")

    # Error handling
    error: Optional[str] = Field(None, description="Any error message encountered during the process")
    
    # Retry counter
    retry_count: int = Field(0, description="Counter for retry attempts")


def check_retry_limit(state):
    """Check if we've reached the maximum number of retries."""
    # Add a note about the retry attempt
    if not hasattr(state, "feedback") or state.feedback is None:
        state.feedback = ""
    
    state.feedback += f"\n\nRetry attempt {state.retry_count}/{MAX_RETRIES}."
    return state


def route_after_validation(state):
    """Determine next step based on grade."""
    return state.next_step if state.next_step else "retry"


def check_retry_status(state):
    """Determine whether to continue retrying or stop."""
    if state.retry_count < MAX_RETRIES:
        return "continue"
    else:
        # Add a final note about reaching retry limit
        if not hasattr(state, "feedback") or state.feedback is None:
            state.feedback = ""
        state.feedback += f"\n\nMaximum retry attempts ({MAX_RETRIES}) reached. Returning best available lesson plan."
        return "stop"


def lesson_plan_graph():
    builder = StateGraph(LessonPlanInput)

    # Add nodes
    builder.add_node("GenerateLessonPlan", generate_lesson_plan)
    builder.add_node("ValidateLessonPlan", validate_lesson_plan)
    builder.add_node("CheckRetries", check_retry_limit)

    # Set entry point
    builder.set_entry_point("GenerateLessonPlan")
    
    # Add edges
    builder.add_edge("GenerateLessonPlan", "ValidateLessonPlan")

    # Add conditional edge from validation
    builder.add_conditional_edges(
        "ValidateLessonPlan",
        route_after_validation,  # Use the helper function
        {
            "valid": END,
            "retry": "CheckRetries"
        },
    )
    
    # Add conditional edge from retry check
    builder.add_conditional_edges(
        "CheckRetries",
        check_retry_status,  # Use the helper function
        {
            "continue": "GenerateLessonPlan",
            "stop": END
        },
    )

    lesson_plan_workflow = builder.compile()
    return lesson_plan_workflow


# Create the compiled graph
xlesson_plan_graph = lesson_plan_graph()
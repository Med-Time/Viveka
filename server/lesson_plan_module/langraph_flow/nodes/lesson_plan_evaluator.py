from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal, Union
import json
import re

# Initialize LLM with lower temperature for more consistent evaluations
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.1)

class LessonPlanEvaluation(BaseModel):
    """Structured evaluation of a lesson plan."""
    grade: Literal["Good", "Bad"] = Field(..., description="Overall grade of the lesson plan")
    feedback: str = Field(..., description="Comprehensive feedback on the lesson plan")
    evaluation_metrics: Dict[str, Dict[str, Any]] = Field(..., description="Detailed metrics for each evaluation criterion")

# Create evaluation prompt template
EVALUATION_PROMPT = """
# LESSON PLAN EVALUATOR

You are an expert educational evaluator specializing in personalized curriculum assessment.

## CONTEXT
- **Subject:** {subject}
- **Goal:** {goal}
- **Learner Level:** {level}
- **Prior Curriculum:** {curriculum}

## LEARNER PROFILE
{persona_summary}

## LESSON PLAN TO EVALUATE
{lesson_plan_text}

## EVALUATION CRITERIA
Evaluate the lesson plan on these key dimensions, assigning a score (1-10) and providing specific comments:

1.  **Total Hour Match:**
    - Is the total duration appropriate for this subject, level, and goal?
    - Score: 1 (insufficient time) to 10 (perfectly appropriate)

2.  **Topic Structure:**
    - Are there 2-7 main chapters with appropriate sub-topics?
    - Score: 1 (poor structure) to 10 (excellent structure)

3.  **Syllabus Coverage:**
    - Does the plan adequately cover all necessary content for the goal?
    - Score: 1 (major gaps) to 10 (comprehensive coverage)

4.  **Sub-topic Granularity:**
    - Are sub-topics appropriately detailed with clear outcomes?
    - Score: 1 (too vague/general) to 10 (perfectly scoped)

5.  **Learning Progression:**
    - Is there a logical sequence from basic to advanced concepts?
    - Score: 1 (illogical jumps) to 10 (perfect progression)

6.  **Time Allocation:**
    - Is time allocation realistic and personalized to the learner's needs?
    - Score: 1 (unrealistic timing) to 10 (perfectly calibrated)

7.  **Personalization:**
    - Does the plan address the specific learner's profile, strengths, and weaknesses?
    - Score: 1 (generic, not personalized) to 10 (perfectly tailored)

## GRADING
Determine an overall grade of "Good" or "Bad" based on your evaluation:
- "Good": The lesson plan scores 7+ in at least 5 categories with no category below 5
- "Bad": The lesson plan fails to meet the above criteria

## SPECIFIC FEEDBACK
Provide actionable feedback explaining:
1.  What aspects of the lesson plan are effective
2.  What specifically needs improvement
3.  How the plan could better address the learner's specific needs
4.  How to improve any low-scoring areas

## IMPORTANT: YOUR RESPONSE FORMAT
{format_instructions}
"""

def format_persona_for_evaluation(persona_data: Dict[str, Any]) -> str:
    """Formats persona data into a readable string for the evaluation prompt."""
    sections = []

    # Extract key sections for evaluation context
    if profile := persona_data.get("learner_profile_summary"):
        sections.append(f"**Learner Profile:** {profile}")

    if styles := persona_data.get("learning_style_assessment"):
        style_points = "\n".join([f"- {s}" for s in styles])
        sections.append(f"**Learning Style:**\n{style_points}")

    if strengths := persona_data.get("strengths"):
        strength_points = "\n".join([f"- {s}" for s in strengths])
        sections.append(f"**Strengths:**\n{strength_points}")

    if weaknesses := persona_data.get("weaknesses_and_gaps"):
        weakness_points = "\n".join([f"- {w}" for w in weaknesses])
        sections.append(f"**Areas for Improvement:**\n{weakness_points}")

    return "\n\n".join(sections) if sections else "Limited learner profile information available."

def format_lesson_plan_text(lesson_plan: Union[str, BaseModel, Dict[str, Any]]) -> str:
    """
    Formats a lesson plan object (Pydantic model, dict, or string) into a readable text.
    Assumes lesson_plan is a LessonPlanModule or similar structure.
    """
    try:
        # If it's a string, return as is
        if isinstance(lesson_plan, str):
            return lesson_plan
            
        # If it's a dictionary or object with model_dump method
        plan_dict = lesson_plan.model_dump() if hasattr(lesson_plan, 'model_dump') else lesson_plan
        
        # Format as text
        text = [f"# {plan_dict.get('subject_name', 'Lesson Plan')}"]
        text.append(f"Level: {plan_dict.get('learner_level', 'Not specified')}")
        text.append(f"Goal: {plan_dict.get('learner_goal', 'Not specified')}")
        text.append(f"Total Hours: {plan_dict.get('total_module_time_hours', 'Not specified')}")
        text.append(f"Overall Outcome: {plan_dict.get('overall_course_outcome', 'Not specified')}")
        
        # Add prerequisites if available
        if prereqs := plan_dict.get('prerequisites'):
            text.append("\nPrerequisites:")
            for prereq in prereqs:
                text.append(f"- {prereq}")
                
        # Add chapters and subtopics
        if chapters := plan_dict.get('chapters'):
            text.append("\n## Chapters:")
            for i, chapter in enumerate(chapters, 1):
                text.append(f"\n### Chapter {i}: {chapter.get('chapter_title')}")
                text.append(f"Outcome: {chapter.get('chapter_outcome')}")
                text.append(f"Time: {chapter.get('chapter_total_time_minutes')} minutes")
                
                if subtopics := chapter.get('sub_topics'):
                    for j, topic in enumerate(subtopics, 1):
                        text.append(f"\n#### {j}. {topic.get('sub_topic_title')}")
                        text.append(f"Outcome: {topic.get('sub_topic_outcome')}")
                        text.append(f"Time: {topic.get('estimated_time_minutes')} minutes")
        
        # Add adaptive notes if available
        if notes := plan_dict.get('adaptive_notes'):
            text.append(f"\n## Adaptive Notes:\n{notes}")
            
        return "\n".join(text)
        
    except Exception as e:
        return f"Error formatting lesson plan: {str(e)}\n{str(lesson_plan)}"

def validate_lesson_plan(state: BaseModel) -> str:
    """
    LangGraph node to evaluate the generated lesson plan.
    Updates the state with evaluation results and returns a routing string.

    Args:
        state: The current LangGraph state containing the generated lesson plan

    Returns:
        A string ("valid" or "invalid + Feedback") to route the graph.
    """
    # Initialize retry counter if it doesn't exist
    if not hasattr(state, "retry_count"):
        state.retry_count = 0
    
    # Increment the retry counter
    state.retry_count += 1
    
    # Set maximum retries
    MAX_RETRIES = 3  # Adjust as needed
    
    # Check if lesson plan was generated successfully
    if not hasattr(state, "lesson_plan") or not state.lesson_plan:
        state.grade = "Bad"
        state.feedback = "No lesson plan was generated to evaluate."
        state.evaluation_metrics = {}
        
        # Check retry count
        if state.retry_count >= MAX_RETRIES:
            state.feedback += f"\n\nMaximum retry attempts ({MAX_RETRIES}) reached. Unable to generate a valid lesson plan."
            state.next_step = "valid"
            return state  # End the loop by returning "valid" even though it's bad
        
        else:
            state.next_step = "retry"
        return state
    
    
    try:
        # Format persona summary for the prompt
        persona_summary = "No persona information available."
        if hasattr(state, "persona_summary") and state.persona_summary:
            if isinstance(state.persona_summary, dict):
                persona_summary = format_persona_for_evaluation(state.persona_summary)
            else:
                persona_summary = str(state.persona_summary)
            
        # Format curriculum info
        curriculum = "No curriculum information available."
        if hasattr(state, "taken_test_curriculum") and state.taken_test_curriculum:
            if isinstance(state.taken_test_curriculum, list):
                curriculum = "\n".join([f"- {topic}" for topic in state.taken_test_curriculum])
            else:
                curriculum = str(state.taken_test_curriculum)
        
        # Format lesson plan for evaluation
        lesson_plan_text = format_lesson_plan_text(state.lesson_plan)
        
        # Initialize Pydantic parser for the evaluation response
        parser = PydanticOutputParser(pydantic_object=LessonPlanEvaluation)

        # Create prompt for evaluation
        evaluation_prompt = ChatPromptTemplate.from_template(
            EVALUATION_PROMPT,
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        
        formatted_prompt = evaluation_prompt.format(
            subject=state.subject,
            goal=state.goal,
            level=state.level,
            curriculum=curriculum,
            persona_summary=persona_summary,
            lesson_plan_text=lesson_plan_text
        )
        
        # Generate evaluation
        response = llm.invoke(formatted_prompt)
        
        # --- Robust JSON Parsing (as LLMs can sometimes add conversational text) ---
        evaluation_data = None
        try:
            # Attempt direct parsing first
            evaluation_data = parser.parse(response.content)
        except Exception:
            # If direct parsing fails, try to extract JSON using regex and then parse
            json_match = re.search(r'\{[\s\S]*\}', response.content)
            if json_match:
                try:
                    raw_json_str = json_match.group(0)
                    # Use the parser for the extracted string
                    evaluation_data = parser.parse(raw_json_str)
                except json.JSONDecodeError:
                    # Still couldn't parse the extracted JSON
                    pass # Handled below
            
        if evaluation_data:
            # Update state with evaluation results from the parsed Pydantic object
            state.grade = evaluation_data.grade
            state.feedback = evaluation_data.feedback
            state.evaluation_metrics = evaluation_data.evaluation_metrics
        else:
            # Fallback if parsing completely fails
            state.grade = "Bad"
            state.feedback = f"Could not parse evaluation results. Raw LLM response: {response.content}"
            state.evaluation_metrics = {}
            state.next_step = "retry"
            return state # Parsing failed, means invalid evaluation

    except Exception as e:
        # Handle any other errors during evaluation
        state.grade = "Bad"
        state.feedback = f"Error during lesson plan evaluation: {str(e)}"
        state.evaluation_metrics = {}
        state.next_step = "retry"
        return state # Error during evaluation, means invalid

    # Determine routing based on grade
    if state.grade == "Good":
        #state.lesson_plan = state.lesson_plan
        state.next_step = "valid"
    elif state.retry_count >= MAX_RETRIES:
        state.feedback += f"\n\nMaximum retry attempts ({MAX_RETRIES}) reached. Returning best available lesson plan."
        state.next_step = "valid"  # End the loop even with a "Bad" grade after max retries
    else:
        state.next_step = "retry"
        
    return state  # Return the state object, not a string
    
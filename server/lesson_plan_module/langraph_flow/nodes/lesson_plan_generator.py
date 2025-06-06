from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal, Union

# Initialize LLM
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.2)

# Define Pydantic models for structured output
class SubTopic(BaseModel):
    """Represents a granular learning segment within a main chapter."""
    sub_topic_title: str = Field(..., description="The concise title of this specific sub-topic.")
    sub_topic_outcome: str = Field(..., description="A clear, actionable statement of what the user will be able to do or understand after successfully completing this sub-topic.")
    estimated_time_minutes: int = Field(..., description="Estimated time in minutes required for the user to learn and grasp this sub-topic.")

class Chapter(BaseModel):
    """Represents a main learning chapter or unit within the lesson plan."""
    chapter_title: str = Field(..., description="The title of this main chapter.")
    chapter_outcome: str = Field(..., description="A clear, actionable statement of what the user will be able to do or understand after successfully completing this entire chapter.")
    sub_topics: List[SubTopic] = Field(..., description="An intelligently divided list of granular sub-topics that constitute this chapter.")
    chapter_total_time_minutes: int = Field(..., description="Total estimated time in minutes to complete this chapter, calculated as the sum of its sub-topics' estimated times.")

class LessonPlanModule(BaseModel):
    """Represents the complete personalized lesson plan tailored for the user."""
    subject_name: str = Field(..., description="The academic subject of this lesson plan.")
    learner_level: str = Field(..., description="The proficiency level of the user.")
    learner_goal: str = Field(..., description="The user's specific learning goal for this subject.")
    overall_course_outcome: str = Field(..., description="What the user will achieve upon completion.")
    
    chapters: List[Chapter] = Field(..., min_length=2, max_length=7)
    total_module_time_hours: float = Field(..., description="Total estimated time in hours.")
    
    prerequisites: List[str] = Field(default_factory=list)
    adaptive_notes: Optional[str] = Field(None, description="How this plan is personalized.")

# Create parser once
parser = PydanticOutputParser(pydantic_object=LessonPlanModule)

# Define the improved prompt template
LESSON_PLAN_PROMPT = """
# PERSONALIZED LESSON PLAN CREATOR

You are an expert educational curriculum designer specializing in adaptive learning experiences.

## LEARNER CONTEXT
- **Subject:** {subject}
- **Goal:** {goal}
- **Current Level:** {level}
- **Prior Curriculum:** {curriculum}

## LEARNER PROFILE
{persona_summary}

## PREVIOUS FEEDBACK TO ADDRESS
{feedback}

## YOUR TASK
Create a structured, personalized lesson plan following these principles:

1. **Structure:** 2-3 main chapters, each with 3-5 focused sub-topics
2. **Timing:** Realistic time estimates for each component
3. **Progression:** Build logically from fundamentals to advanced concepts
4. **Personalization:** Address learner's strengths/weaknesses from their profile
5. **Adaptation:** Incorporate any previous feedback to improve this plan
6. **Accessibility:** Match content to the learner's specific learning style
7. **Outcomes:** Clear, measurable learning outcomes for each component
8. **Prerequisites:** List any essential knowledge needed before starting

## IMPORTANT DELIVERY NOTES
- Be concise but comprehensive
- Ensure all time estimates are realistic for the learner's level
- If previous feedback exists, explicitly address how you've incorporated it
- Explain your personalization choices based on the learner's profile

## OUTPUT FORMAT
{format_instructions}
"""

def format_persona_summary(persona_data: Union[str, Dict, None]) -> str:
    """Format persona data into a readable summary for the prompt."""
    if not persona_data:
        return "No learner profile available."
        
    if isinstance(persona_data, str):
        return persona_data
        
    if isinstance(persona_data, dict):
        sections = []
        
        # Extract primary profile summary
        if profile := persona_data.get("learner_profile_summary"):
            sections.append(f"**Learner Overview:** {profile}")
            
        # Extract learning style if available
        if styles := persona_data.get("learning_style_assessment"):
            style_text = "\n- ".join([""] + styles)
            sections.append(f"**Learning Style:** {style_text}")
            
        # Extract strengths if available
        if strengths := persona_data.get("strengths"):
            strength_text = "\n- ".join([""] + strengths)
            sections.append(f"**Strengths:** {strength_text}")
            
        # Extract areas for improvement
        if weaknesses := persona_data.get("weaknesses_and_gaps"):
            weakness_text = "\n- ".join([""] + weaknesses)
            sections.append(f"**Areas for Improvement:** {weakness_text}")
            
        # Return formatted text or fallback
        return "\n\n".join(sections) if sections else "Limited learner profile information available."
    
    return "Learner profile format not recognized."

def format_list_or_string(data: Union[List, str, None], default: str = "None available") -> str:
    """Format list or string data consistently."""
    if not data:
        return default
        
    if isinstance(data, list):
        return "\n- " + "\n- ".join(data)
        
    return str(data)

def generate_lesson_plan(state):
    """
    Generate a personalized lesson plan based on the state data.
    Designed for direct integration with LangGraph.
    
    Args:
        state: The current LangGraph state with lesson plan inputs
        
    Returns:
        Updated state with generated lesson plan
    """
    try:
        # Prepare the prompt with all available data
        prompt_template = ChatPromptTemplate.from_template(LESSON_PLAN_PROMPT)
        
        # Format input data for the prompt
        formatted_prompt = prompt_template.format(
            subject=state.subject,
            goal=state.goal, 
            feedback_history=format_list_or_string(getattr(state, "feedback_history", [])),
            level=state.level,
            curriculum=format_list_or_string(getattr(state, "taken_test_curriculum", None)),
            persona_summary=format_persona_summary(getattr(state, "persona_summary", None)),
            feedback=format_list_or_string(getattr(state, "feedback", None), "No previous feedback to incorporate."),
            format_instructions=parser.get_format_instructions()
        )
        
        # Generate the lesson plan using the LLM
        response = llm.invoke(formatted_prompt)
        print("Raw LLM response:", response.content)
        
        # Parse the structured output
        lesson_plan = parser.parse(response.content)
        
        # Update state with the generated plan
        state.lesson_plan = lesson_plan
        state.grade = "Good"
        
    except Exception as e:
        # Handle any errors in generation or parsing
        state.error = str(e)
        state.grade = "Bad"
        state.feedback = f"Failed to generate lesson plan: {str(e)}"
    
    return state

# For direct use outside of LangGraph (e.g., API endpoints)
def generate_lesson_plan_from_data(data: Dict[str, Any]) -> LessonPlanModule:
    """
    Generate a lesson plan from raw dictionary data.
    
    Args:
        data: Dictionary with lesson plan inputs
        
    Returns:
        Structured LessonPlanModule object
    """
    # Create temporary state-like object
    class TempState:
        pass
    
    state = TempState()
    
    # Transfer data to state object
    for key, value in data.items():
        setattr(state, key, value)
    
    # Use the main function
    result_state = generate_lesson_plan(state)
    
    # Return just the lesson plan
    if hasattr(result_state, "error"):
        raise ValueError(result_state.error)
    
    return result_state.lesson_plan
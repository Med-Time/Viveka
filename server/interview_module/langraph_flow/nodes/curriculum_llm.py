
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from interview_module.services.mongo_persistence import save_curriculum
load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
from langchain.prompts import PromptTemplate
from pydantic import BaseModel, Field
from typing import List

class CurriculumList(BaseModel):
    curriculum: List[str] = Field(..., description="A list of 5-7 foundational and progressively challenging concepts that form a logical learning path for the user's specific goal and level. Each concept should be a clear, distinct topic suitable for a dedicated learning module.")

structured_llm = llm.with_structured_output(CurriculumList)

def generate_curriculum_llm(state):
    prompt_str = """
    You are an expert curriculum designer for a personalized AI learning platform.
    Your primary goal is to create a highly focused and progressive curriculum tailored to a single learner's specific needs.

    The learner wants to study **{subject}**.
    Their stated learning goal is: **"{goal}"**.
    Their current estimated proficiency level is: **{level}**.

    **Your Task:**
    Generate a list of 5 to 7 core concepts that will form the initial, personalized learning roadmap for this student. These concepts will be used to conduct an interview and subsequently generate a detailed lesson plan.

    **Strict Requirements & Guidelines:**
    1.  **Personalization:** The concepts MUST directly align with the user's explicit `{goal}` and `{level}`.
        * **Example for Python Goal (Beginner):** If the goal is "understand beginner-friendly Python," concepts should start with fundamentals like "Variables and Data Types," "Lists and Tuples," "Conditional Statements," "Loops," "Functions," and NOT advanced topics like "Multithreading" or "Decorators."
        * **Example for Advanced Goal:** If the goal is "master advanced deep learning concepts," the concepts should be appropriately complex.
    2.  **Logical Progression:** The concepts must be ordered sequentially, from the most foundational or prerequisite topic to more advanced ones within the scope of the user's goal. They should build upon each other logically.
    3.  **Interview-Worthy:** Each concept should be substantial enough to be explored in an interview question, allowing assessment of the user's understanding.
    4.  **Clarity & Conciseness:** Each concept name in the list should be clear, concise, and unambiguous. Avoid lengthy descriptions; just the concept title.
    5.  **Output Format:** Provide ONLY the list of concepts in the exact Pydantic `CurriculumList` format. Do not include any introductory or concluding remarks, explanations, or numbering outside of the structured output.

    **Consider Edge Cases:**
    * If the goal is extremely broad, interpret it reasonably within the context of a structured learning path and default to foundational concepts.
    * If the level seems inconsistent with the goal (e.g., "beginner" with "master quantum physics"), prioritize foundational topics that realistically lead towards the stated goal, even if it implies a longer journey.
    * If the subject is highly niche, focus on the most fundamental concepts within that niche that would be required to achieve the goal.

    """
    prompt = PromptTemplate.from_template(prompt_str)
    state_dict = {
        "subject": state.subject,
        "level": state.level,
        "goal": state.goal
    }

    input_prompt = prompt.format(**state_dict)
    response = structured_llm.invoke(input_prompt)
    state.curriculum = response.curriculum
    save_curriculum(state.session_id, state.curriculum)
    print(f"Curriculum: {response.curriculum}")
    return state
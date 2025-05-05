from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
from langchain.prompts import PromptTemplate

from pydantic import BaseModel, Field
from typing import List

class CurriculumList(BaseModel):
    curriculum: List[str] = Field(..., description="List of 5 interview-worthy concepts based on subject/goal")

structured_llm = llm.with_structured_output(CurriculumList)
def generate_curriculum_llm(state):
    prompt = PromptTemplate.from_template(
        "List 5 core concepts to assess in {subject} at {level} level for the goal: {goal}."
    )

    state_dict = {
        "subject": state.subject,
        "level": state.level,
        "goal": state.goal
    }
    
    # Use the dictionary for formatting
    input_prompt = prompt.format(**state_dict)
    response = structured_llm.invoke(input_prompt)
    state.curriculum = response.curriculum
    print(f"Curriculum: {response.curriculum}")
    return state

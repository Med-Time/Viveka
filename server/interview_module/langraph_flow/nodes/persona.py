from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
from core.mongo import persona_col  # ← new

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
from pydantic import BaseModel, Field
from typing import List

class PersonaSummary(BaseModel):
    persona_type: str = Field(..., description="Label or title for the user's learning persona for that subject which will be beneficial to make the learning process more effective")
    report: str = Field(..., description="Detailed description of learning behavior, strengths, and recommendations")

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
structured_llm = llm.with_structured_output(PersonaSummary)
def run_persona(state):
    qa_pairs = zip(state.question_history, state.answer_history, state.score_history)
    input_text = "\n".join([
        f"Q: {q}\nA: {a}\nScore: {s}" for q, a, s in qa_pairs
    ])

    prompt = f"""
    Based on the following Q&A with scores, generate a short learning persona report.
    Emphasize tone, confidence, and areas of strength or weakness.

    {input_text}
    """
    persona = structured_llm.invoke(prompt)
    #state.persona_summary = persona
    print(f"Persona: {persona.persona_type}")
    print(f"Report: {persona.report}")
    # Save to MongoDB
    persona_col.insert_one({
        "user_id": state.user_id,
        "type": "interview",
        "report_text": persona.persona_type,
        "report": persona.report,
    })

    return state

# from core.vector_Store import search_similar_chunks

# def generate_curriculum_rag(state):
#     # Build user-specific query
#     query = f"{state.subject} {state.goal} {state.level}"
    
#     results = search_similar_chunks(query_text=query, top_k=15)
    
#     # Extract section titles from payloads
#     unique_sections = list({
#         res.payload.get("section_title", "General Concepts")
#         for res in results if res.payload.get("type") == "content"
#     })

#     if not unique_sections:
#         unique_sections = ["Introduction", "Fundamentals", "Advanced Concepts"]
    
#     # Update state
#     state.curriculum = unique_sections[:5]  # Limit to 5 main topics
#     return state

from core.vector_Store import search_similar_chunks
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")

from pydantic import BaseModel, Field
from typing import List

class CurriculumList(BaseModel):
    curriculum: List[str] = Field(..., description="List of 5 interview-worthy concepts based on subject/goal")
structured_llm = llm.with_structured_output(CurriculumList)
def generate_curriculum_rag(state):
    query = f"{state.subject} {state.goal} {state.level}"
    results = search_similar_chunks(query, top_k=15)

    chunks = "\n\n".join([
        f"Title: {r.payload.get('section_title', 'Unknown')}\n{r.payload.get('content', '')[:400]}"
        for r in results if "content" in r.payload
    ])

    prompt = f"""
    A learner wants to study {state.subject} with the goal "{state.goal}" at {state.level} level.
    Given the following study material excerpts, select 5 important and interview-worthy topics to build their curriculum:

    {chunks}
    """

    response = structured_llm.invoke(prompt)
    state.curriculum = response.curriculum
    print(f"Curriculum: {response.curriculum}")
    return state

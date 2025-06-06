
from interview_module.core.vector_Store import search_similar_chunks
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from interview_module.services.mongo_persistence import save_curriculum

load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
from pydantic import BaseModel, Field
from typing import List

class CurriculumList(BaseModel):
    curriculum: List[str] = Field(..., description="A list of 5-7 foundational and progressively challenging concepts extracted from the provided text, forming a logical learning path for the user's specific goal and level. Each concept should be a clear, distinct topic suitable for a dedicated learning module.")

structured_llm = llm.with_structured_output(CurriculumList)

def generate_curriculum_rag(state):
    query = f"{state.subject} {state.goal} {state.level}"
    results = search_similar_chunks(query, top_k=15) # Increased top_k for more context

    chunks = "\n\n".join([
        f"--- Document Title: {r.payload.get('section_title', 'Unknown')}\n--- Content Snippet:\n{r.payload.get('content', '')[:600]}\n" # Show more content per chunk
        for r in results if "content" in r.payload
    ])

    if not chunks: # Handle case where no relevant chunks are found
        # Fallback strategy: If no relevant RAG chunks, try LLM-only curriculum
        # This is a critical edge case. You might want to transition to LLM_curriculum directly here.
        # For this prompt, we'll assume chunks exist, and the LLM will be told to handle if they are truly irrelevant.
        # However, a robust LangGraph flow might have a conditional edge.
        print("WARNING: No relevant chunks found for RAG curriculum. Consider falling back to LLM-only.")
        # As a temporary measure, we can provide a default empty curriculum or switch state
        # state.curriculum = [] # Or transition to LLM path
        # return state

    prompt = f"""
    You are an expert curriculum designer for a personalized AI learning platform, specifically leveraging provided learning materials.
    Your primary goal is to create a highly focused and progressive curriculum tailored to a single learner's specific needs, **based on the provided relevant text chunks**.

    The learner wants to study **{state.subject}**.
    Their stated learning goal is: **"{state.goal}"**.
    Their current estimated proficiency level is: **{state.level}**.

    **Relevant Learning Materials (Chunks from your knowledge base):**
    {chunks}

    **Your Task:**
    Based *only* on the provided `Relevant Learning Materials` and the learner's subject, goal, and level, generate a list of 2 to 3 core concepts. These concepts will form the initial, personalized learning roadmap for this student, to be used for an interview and subsequent detailed lesson plan generation.

    **Strict Requirements & Guidelines:**
    1.  **Material-Grounded:** All concepts MUST be directly derivable and supported by the information present in the `Relevant Learning Materials`. Do not invent concepts not covered in the provided chunks.
    2.  **Personalization:** The concepts MUST directly align with the user's explicit `{state.goal}` and `{state.level}`.
        * **Example for Python Goal (Beginner):** If the goal is "understand beginner-friendly Python," concepts should be foundational (e.g., "Variables," "Lists," "Functions") and found within the provided texts.
    3.  **Logical Progression:** The concepts must be ordered sequentially, from the most foundational or prerequisite topic to more advanced ones within the scope of the user's goal and the provided materials. They should build upon each other logically.
    4.  **Interview-Worthy:** Each concept should be substantial enough to be explored in an interview question, allowing assessment of the user's understanding based on the provided material.
    5.  **Clarity & Conciseness:** Each concept name in the list should be clear, concise, and unambiguous. Avoid lengthy descriptions; just the concept title.
    6.  **Output Format:** Provide ONLY the list of concepts in the exact Pydantic `CurriculumList` format. Do not include any introductory or concluding remarks, explanations, or numbering outside of the structured output.

    **Consider Edge Cases:**
    * **Limited Relevance:** If the provided `Relevant Learning Materials` are very sparse or not well-aligned with the user's specific `{state.subject}`, `{state.goal}`, or `{state.level}`, generate the most relevant and foundational concepts possible from what's available. If truly no relevant concepts can be extracted, provide an empty list or the most generic foundational concepts if absolutely necessary, but preferably indicate the lack of relevant content.
    * **Overly Broad Chunks:** If chunks contain many advanced topics, but the user is "beginner," selectively choose only the beginner-appropriate concepts from those chunks.
    * **Goal Specificity:** Always prioritize concepts that directly contribute to the *specific* stated goal, even if other topics are present in the chunks.

    """
    response = structured_llm.invoke(prompt)
    state.curriculum = response.curriculum
    save_curriculum(state.session_id, state.curriculum)
    print(f"Curriculum: {response.curriculum}")
    return state
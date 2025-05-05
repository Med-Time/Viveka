from core.vector_Store import search_similar_chunks
from langchain_google_genai import ChatGoogleGenerativeAI
import random
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
from pydantic import BaseModel, Field
from typing import List
question_variations = [
    "detailed_answer",
    "one_word_answer",
    "mcq",
    "fill_in_the_blanks"
]

variation_prompts = {
    "detailed_answer": "Please provide a detailed explanation.",
    "one_word_answer": "Please provide a one-word answer.",
    "mcq": "Please create an MCQ (Multiple Choice Question) with four options.",
    "fill_in_the_blanks": "Please generate a fill-in-the-blanks question."
}
class QuestionResponse(BaseModel):
    question: str = Field(..., description="LLM-generated interview question for current concept it might be detailed_answer, one_word_answer, mcq, or fill_in_the_blanks")
structured_llm = llm.with_structured_output(QuestionResponse)
def generate_question_rag(state):
    concept = state.curriculum[state.current_concept_index]
    results = search_similar_chunks(concept, top_k=5)
    variation = random.choice(question_variations)
    extra_instruction = variation_prompts[variation]

    context_chunks = [
        r.payload.get("content", "")
        for r in results
        if r.payload.get("type") == "content" and "content" in r.payload
    ]

    if not context_chunks:
        state.current_question = f"What do you know about: {concept}?"
        return state

    context = "\n\n".join(context_chunks[:3])

    prompt = f"""
    You are a helpful tutor. Generate one concise question on basis of {extra_instruction} to assess a Level {state.level} student's understanding of the following:

        Subject: {state.subject}  
        Concept: {concept}  
        Additional Instructions: {extra_instruction}

        Requirements:
        - The question must directly involve the specified concept.
        - Clearly indicate the type of question (e.g., multiple choice, short answer, etc.).
        - Return only the question text.
        - Do not include any explanations or additional information.
        - The question should be appropriate for the specified level..

    Context:
    {context}

    Only generate one clear question.
    """

    response= structured_llm.invoke(prompt)
    print(response)
    print(response.question)
    state.current_question = response.question
    return state

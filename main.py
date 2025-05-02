# ✅ Goal: Adaptive Evaluation Agent (Dynamic Curriculum, Smarter User Interaction, Google Gemini, MCQ Handling, Summary)

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Optional
from dotenv import load_dotenv
import os
from IPython.display import display, Image
import random

load_dotenv()

# --- Define the state schema ---
class EvaluationState(TypedDict):
    user_level: Optional[str]
    user_goal: Optional[str]
    current_concept: Optional[str]
    curriculum: Optional[List[str]]
    subject: Optional[str]
    concept_scores: dict
    question_history: List[str]
    answer_history: List[str]
    last_score: Optional[int]
    done: bool

# --- Initialize LLM (Google Gemini)
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")

# --- Variations of Questions ---
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

# --- Modular: Generate a Question with Variation ---
def generate_question(subject: str, concept: str, level: str) -> str:
    variation = random.choice(question_variations)
    extra_instruction = variation_prompts[variation]
    prompt = ChatPromptTemplate.from_template(
        """
        You are a helpful tutor. Generate one concise question to assess a Level {level} student's understanding of the following:

        Subject: {subject}  
        Concept: {concept}  
        Additional Instructions: {extra_instruction}

        Requirements:
        - The question must directly involve the specified concept.
        - Clearly indicate the type of question (e.g., multiple choice, short answer, etc.).
        - Return only the question text.
        - Do not include any explanations or additional information.
        - The question should be appropriate for the specified level.
        """
    )
    return llm.invoke(prompt.format(subject=subject, concept=concept, level=level, extra_instruction=extra_instruction)).content.strip()

# --- Modular: Evaluate Student Answer ---
def score_answer(subject: str, answer: str, question: str) -> int:
    prompt = ChatPromptTemplate.from_template(
        """
        You are an AI tutor tasked with grading a student's answer.

        Context:
        - Subject: {subject}
        - Question: {question}
        - Student Answer: {answer}

        Instructions:
        - If the question is an MCQ and the selected option is correct, return 100; otherwise, return 0.
        - For other types of questions:
            - If the answer is empty, null, missing, or irrelevant, return 0.
            - Otherwise, assign a score between 0 and 100 based on:
              - 100: Fully correct and complete
              - 50-80: Partially correct or incomplete
              - 1-40: Mostly incorrect or severely incomplete
        - Only return the numeric score.
        - Do not explain your reasoning or include any extra text.
        """
    )
    score_str = llm.invoke(prompt.format(subject=subject, question=question, answer=answer)).content.strip()
    try:
        return int(score_str)
    except:
        return 0

# --- Generate Dynamic Curriculum based on User Goal ---
def generate_curriculum_from_goal(goal: str) -> List[str]:
    prompt = ChatPromptTemplate.from_template(
        """
        You are a curriculum designer AI. Based on the user's learning goal: "{goal}", suggest a list of key concepts (maximum 5) the student must master.
        Return only a comma-separated list of concepts.
        """
    )
    concepts_text = llm.invoke(prompt.format(goal=goal)).content.strip()
    return [concept.strip() for concept in concepts_text.split(",") if concept]

# --- Summarize Performance ---
def summarize_performance(scores: dict) -> str:
    avg_score = sum(scores.values()) / len(scores) if scores else 0
    if avg_score >= 80:
        feedback = "Excellent understanding! You are ready to move to advanced topics."
    elif avg_score >= 50:
        feedback = "Good progress! Consider revising the weaker areas."
    else:
        feedback = "Fundamental concepts need strengthening. Start with basics."

    summary = f"Average Score: {avg_score:.2f}/100\nRecommendation: {feedback}"
    return summary

# --- Node: Ask Question ---
def ask_question(state: EvaluationState) -> EvaluationState:
    subject = state["subject"]
    concept = state['current_concept']
    level = state['user_level']
    question = generate_question(subject, concept, level)
    print(f"\n📘 Question on {concept}: {question}")
    state['question_history'].append(question)
    user_response = input("🗨️  Your Answer: ")

    if user_response == "":
        print("❌ No answer provided. Asking another question...")
        return ask_question(state)
    elif user_response.lower() == "exit":
        state['done'] = True
        print("Exiting the evaluation. Goodbye!")
        return state
    elif user_response.lower() == "skip":
        print("Skipping this question.")
        state['answer_history'].append(None)
        return state
    else:
        print("✅ Answer recorded.")
        state['answer_history'].append(user_response)
        return state

# --- Node: Evaluate Answer ---
def evaluate_answer(state: EvaluationState) -> EvaluationState:
    subject = state["subject"]
    concept = state['current_concept']
    question = state['question_history'][-1]
    answer = state['answer_history'][-1]
    if answer is None:
        state['last_score'] = 0
        state['concept_scores'][concept] = 0
        return state
    score = score_answer(subject, answer, question)
    print(f"🔍 Score for {concept}: {score}/100")
    state['last_score'] = score
    state['concept_scores'][concept] = score
    return state

# --- Node: Decide Next Concept ---
def next_concept(state: EvaluationState) -> str:
    curriculum = state.get("curriculum", [])
    if not curriculum:
        state['done'] = True
        return END

    current = state['current_concept']
    score = state['last_score'] or 0

    if score >= 80:
        idx = curriculum.index(current)
        if idx + 1 < len(curriculum):
            state['current_concept'] = curriculum[idx + 1]
        else:
            state['done'] = True
    elif score >= 40:
        print("➡️ Asking a clarification question for deeper understanding...")
    else:
        print("⚠️ Switching to support mode (simpler review material)...")

    return "ask_question" if not state['done'] else END

# --- Define LangGraph ---
graph = StateGraph(EvaluationState)
graph.add_node("ask_question", ask_question)
graph.add_node("evaluate_answer", evaluate_answer)
graph.add_edge("ask_question", "evaluate_answer")
graph.add_conditional_edges("evaluate_answer", next_concept)
graph.set_entry_point("ask_question")
workflow = graph.compile()

# --- Run Flow ---
if __name__ == "__main__":
    print("\n📚 Welcome to the Adaptive Learning Evaluation System!")
    subject = input("Select a subject (default: Operating Systems): ") or "Operating Systems"
    user_level = input("What is your level? (Beginner / Intermediate / Advanced): ") or "Beginner"
    user_goal = input("What do you want to learn or improve?: ") or "Basics of OS"

    curriculum = generate_curriculum_from_goal(user_goal)
    print(f"📜 Generated Curriculum: {curriculum}")
    first_concept = curriculum[0] if curriculum else "Processes"

    initial_state = EvaluationState(
        user_level=user_level,
        user_goal=user_goal,
        subject=subject,
        current_concept=first_concept,
        curriculum=curriculum,
        concept_scores={},
        question_history=[],
        answer_history=[],
        last_score=None,
        done=False
    )

    final_state = workflow.invoke(initial_state)
    print("\n✅ Evaluation complete. Scores:", final_state['concept_scores'])
    print("\n📈 Summary Report:")
    print(summarize_performance(final_state['concept_scores']))

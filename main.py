from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Optional
from dotenv import load_dotenv

load_dotenv()

# --- Define the state schema ---
class EvaluationState(TypedDict):
    user_level: Optional[str]
    user_goal: Optional[str]
    current_concept: Optional[str]
    subject: Optional[str]
    concept_scores: dict
    question_history: List[str]
    answer_history: List[str]
    last_score: Optional[int]
    done: bool

llm = init_chat_model("llama3-8b-8192", model_provider="groq")

# --- Modular: Generate a Question ---
def generate_question(subject:str, concept: str, level: str) -> str:
    prompt = ChatPromptTemplate.from_template(
        """
        You are a helpful tutor. Generate a single concise question to evaluate a student's understanding of:
        Concept: {concept} from the Subject {subject}
        Student Level: {level}
        Only return the question.
        """
    )
    return llm.invoke(prompt.format(subject=subject, concept=concept, level=level)).content.strip()

# --- Modular: Evaluate Student Answer ---
def score_answer(subject: str, answer: str, question: str) -> int:
    prompt = ChatPromptTemplate.from_template(
        """
        You are an AI tutor. Evaluate the student's answer.
        Subject : {subject}
        Question: {question}
        Answer: {answer}
        Return a number between 0 and 100 based on correctness and completeness. If you cannot evaluate, return 0.
        Just return the number only.
        """
    )
    score_str = llm.invoke(prompt.format(subject=subject, question=question, answer=answer,)).content.strip()
    try:
        return int(score_str)
    except:
        return 0

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
        print("❌ No answer provided. Please try again.")
        # Re-ask the question Don't send to evaluate 
    elif user_response.lower() == "exit":
        state['done'] = True
        print("Exiting the evaluation. Goodbye!")
        # After exit, we don't want to send to evaluate
    elif user_response.lower() == "skip":
        print("Skipping this question.")
        state['answer_history'].append(None)
        # Don't send to evaluate
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
    score = score_answer(subject, answer, question)
    print(f"🔍 Score for {concept}: {score}/100")
    state['last_score'] = score
    state['concept_scores'][concept] = score
    return state

# --- Node: Decide Next Concept ---
def next_concept(state: EvaluationState) -> str:
    curriculum_by_subject = {
        "Operating Systems": ["Processes", "Threads", "CPU Scheduling", "Memory Management"],
    }  # Can be expanded for other subjects as needed with the help of LLM
    subject = state['subject'] or "Operating Systems"
    curriculum = curriculum_by_subject.get(subject, curriculum_by_subject["Operating Systems"])
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
    goal = input("What do you want to learn or improve?: ") or "Basics of OS"

    curriculum_default = {
        "Operating Systems": "Processes",
    }
    first_concept = curriculum_default.get(subject, "Processes")

    initial_state = EvaluationState(
        user_level=user_level,
        user_goal=goal,
        subject=subject,
        current_concept=first_concept,
        concept_scores={},
        question_history=[],
        answer_history=[],
        last_score=None,
        done=False
    )

    final_state = workflow.invoke(initial_state)
    print("\n✅ Evaluation complete. Scores:", final_state['concept_scores'])

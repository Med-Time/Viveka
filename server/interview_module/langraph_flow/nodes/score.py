from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")

def score_answer(state):
    answer = state["answer"]
    question = state["current_question"]
    prompt = f"""
    You are an evaluator. Score the following answer to this question:
    
    Q: {question}
    A: {answer}

    Score (0–100):
    """
    result = llm.predict(prompt).strip()
    score = int("".join(filter(str.isdigit, result)))
    
    # Update state
    state["score_history"].append(score)
    state["answer_history"].append(answer)
    state["question_history"].append(question)
    
    return state

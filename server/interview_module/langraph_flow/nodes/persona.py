from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")

def run_persona(state):
    qa_pairs = zip(state["question_history"], state["answer_history"], state["score_history"])
    input_text = "\n".join([
        f"Q: {q}\nA: {a}\nScore: {s}" for q, a, s in qa_pairs
    ])
    
    prompt = f"""
    Based on the following Q&A with scores, generate a short learning persona report.
    Emphasize tone, confidence, and areas of strength or weakness.

    {input_text}
    """
    persona = llm.predict(prompt)
    state["persona_summary"] = persona
    return state

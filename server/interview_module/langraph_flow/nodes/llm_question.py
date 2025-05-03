from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")

def generate_question_llm(state):
    concept = state["curriculum"][state["current_concept_index"]]
    level = state["level"]
    prompt = f"Generate a {level}-level interview question on: {concept}"
    question = llm.predict(prompt)
    state["current_question"] = question
    return state

from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
from langchain.prompts import PromptTemplate



def generate_curriculum_llm(state):
    prompt = PromptTemplate.from_template(
        "List 5 core concepts to assess in {subject} at {level} level for the goal: {goal}."
    )
    input_prompt = prompt.format(**state)
    response = llm.predict(input_prompt)
    state["curriculum"] = response.strip().split("\n")
    return state

from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
from pydantic import BaseModel, Field
from typing import List

class ScoreEvaluation(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Score between 0 and 100 for the user's last answer")
    #feedback: str = Field(..., description="Feedback or reasoning explaining the score given by the LLM")
structured_llm = llm.with_structured_output(ScoreEvaluation)
def score_answer(state):
    answer = state.answer
    question = state.current_question
    prompt = f"""
    You are an evaluator. Score the following answer to this question:
    
    Q: {question}
    A: {answer}

    Score (0-100):
    """
    result = structured_llm.invoke(prompt)
    score = result.score
    #feedback = result.feedback
    print(f"Score: {score}")
    # Update state
    state.score_history.append(score)
    state.answer_history.append(answer)
    state.question_history.append(question)
    
    return state

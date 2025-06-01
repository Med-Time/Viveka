from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from pydantic import BaseModel, Field

class NextAction(BaseModel):
    action: str = Field(..., description='Action to take: "retry", "next", or "end"')
    reason: str = Field(..., description="Brief explanation for the decision")

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
structured_llm = llm.with_structured_output(NextAction)

def decide_next(state):
    # Prepare interview progress summary
    prompt = PromptTemplate.from_template("""
You are an intelligent interview flow controller.

Here is the latest question asked:
{current_question}

And here is the user's most recent answer:
{latest_answer}

It was scored {last_score}/100.

Retry count for this concept: {retry_count}
Concept index: {current_index} / {total_concepts}

Rules:
- If score ≥ 50 and retry_count < 3 → Move to next concept.
- If score < 50 and retry_count < 3 → Retry same concept.
- If retry_count ≥ 3 → Move to next concept anyway.
""")


    input_prompt = prompt.format(
    current_question=state.current_question,
    latest_answer=state.answer,
    last_score=state.score_history[-1] if state.score_history else 0,
    current_index=state.current_concept_index,
    total_concepts=len(state.curriculum),
    retry_count=state.retry_count
)


    decision = structured_llm.invoke(input_prompt)
    print(f"DEBUG: Decision made: {decision}")

    # Apply the decision to state
    if decision.action == "retry":
        state.retry_count += 1
    elif decision.action == "next":
        state.current_concept_index += 1
        state.retry_count = 0
    elif decision.action == "end":
        state.done = True

    # Also safeguard end based on concept overflow
    if state.current_concept_index >= len(state.curriculum):
        state.done = True

    return state

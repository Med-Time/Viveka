from interview_module.core.vector_Store import search_similar_chunks
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
from pydantic import BaseModel, Field

class RelevanceCheck(BaseModel):
    is_relevant: bool = Field(..., description="Whether vector DB content is relevant to the user's subject and goal")

structured_llm = llm.with_structured_output(RelevanceCheck)
def check_docs(state):
    query = f"{state.subject} {state.goal} {state.level}"
    results = search_similar_chunks(query, top_k=5)
    print(results)
    if not results:
        state.use_rag = False
        return state

    content_samples = "\n\n".join([
        f"Section: {r.payload.get('section_title')}\n{r.payload.get('content')[:150]}"
        for r in results if "content" in r.payload
    ])
    print(content_samples)

    prompt = f"""
    A student wants to learn about "{state.subject}" to achieve the goal "{state.goal}" at a {state.level} level.
    Below are excerpts from available learning documents.

    Determine if these materials are appropriate to support their learning (yes/no):

    {content_samples}
    """

    response = structured_llm.invoke(prompt)
    state.use_rag = response.is_relevant
    
    if state.use_rag:
        print("Relevant documents found:")
    else:
        print("No relevant documents found.")
    
    return state

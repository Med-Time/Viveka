from langgraph.graph import StateGraph
from langraph_flow.nodes.curriculum_llm import generate_curriculum_llm
from langraph_flow.nodes.curriculum_rag import generate_curriculum_rag
from langraph_flow.nodes.check_docs import check_docs
from langraph_flow.nodes.rag_question import generate_question_rag
from langraph_flow.nodes.llm_question import generate_question_llm
from langraph_flow.nodes.score import score_answer
from langraph_flow.nodes.decide import decide_next
from langraph_flow.nodes.persona import run_persona

# state_schema = {
#     "user_id": str,
#     "subject": str,
#     "goal": str,
#     "level": str,
#     "curriculum": list,
#     "current_concept_index": int,
#     "current_question": str,
#     "question_history": list,
#     "answer_history": list,
#     "score_history": list,
#     "retry_count": int,
#     "use_rag": bool,
#     "done": bool
# }

# builder = StateGraph(state_schema)

from pydantic import BaseModel, Field
from typing import List

class InterviewState(BaseModel):
    user_id: str
    subject: str
    goal: str
    level: str
    curriculum: List[str] = Field(default_factory=list)
    current_concept_index: int = 0
    current_question: str = ""
    question_history: List[str] = Field(default_factory=list)
    answer_history: List[str] = Field(default_factory=list)
    score_history: List[int] = Field(default_factory=list)
    retry_count: int = 0
    use_rag: bool = False
    done: bool = False

builder = StateGraph(InterviewState)

builder.add_node("CheckDocs", check_docs)
builder.add_conditional_edges("CheckDocs", lambda s: "GenerateCurriculumRAG" if s["use_rag"] else "GenerateCurriculumLLM")
builder.add_node("GenerateCurriculumRAG", generate_curriculum_rag)
builder.add_node("GenerateCurriculumLLM", generate_curriculum_llm)
builder.add_node("AskQuestionRAG", generate_question_rag)
builder.add_node("AskQuestionLLM", generate_question_llm)
builder.add_node("ScoreAnswer", score_answer)
builder.add_node("DecideNext", decide_next)
builder.add_node("Persona", run_persona)

builder.set_entry_point("CheckDocs")
builder.add_edge("GenerateCurriculumRAG", "AskQuestionRAG")
builder.add_edge("GenerateCurriculumLLM", "AskQuestionLLM")
builder.add_edge("AskQuestionRAG", "ScoreAnswer")
builder.add_edge("AskQuestionLLM", "ScoreAnswer")
builder.add_edge("ScoreAnswer", "DecideNext")
builder.add_conditional_edges("DecideNext", lambda s: "AskQuestionRAG" if s["use_rag"] else "AskQuestionLLM", {"done": "Persona"})

interview_graph = builder.compile()

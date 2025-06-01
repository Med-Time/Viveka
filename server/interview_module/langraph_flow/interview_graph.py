from langgraph.graph import StateGraph, END
from interview_module.langraph_flow.nodes.curriculum_llm import generate_curriculum_llm
from interview_module.langraph_flow.nodes.curriculum_rag import generate_curriculum_rag
from interview_module.langraph_flow.nodes.check_docs import check_docs
from interview_module.langraph_flow.nodes.rag_question import generate_question_rag
from interview_module.langraph_flow.nodes.llm_question import generate_question_llm
from interview_module.langraph_flow.nodes.score import score_answer
from interview_module.langraph_flow.nodes.decide import decide_next
from interview_module.langraph_flow.nodes.persona import run_persona

from pydantic import BaseModel, Field
from typing import List, Optional

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
    answer: Optional[str] = None
    feedback_history: List[str] = Field(default_factory=list)  # Add this line
    current_question_type: Optional[str] = None  
    score_history: List[int] = Field(default_factory=list)
    retry_count: int = 0
    use_rag: bool = False
    done: bool = False
    session_id: Optional[str] = None
    persona_summary: Optional[str] = None

# Create a graph for just the first question (curriculum + first question)
def create_initial_question_graph():
    builder = StateGraph(InterviewState)
    
    # Add nodes needed for initial flow
    builder.add_node("CheckDocs", check_docs)
    builder.add_node("GenerateCurriculumRAG", generate_curriculum_rag)
    builder.add_node("GenerateCurriculumLLM", generate_curriculum_llm)
    builder.add_node("AskQuestionRAG", generate_question_rag)
    builder.add_node("AskQuestionLLM", generate_question_llm)
    
    # Set entry point
    builder.set_entry_point("CheckDocs")
    
    # Define conditional routing from CheckDocs
    builder.add_conditional_edges(
        "CheckDocs",
        lambda s: "GenerateCurriculumRAG" if s.use_rag else "GenerateCurriculumLLM"
    )
    
    # Connect curriculum to question generation
    builder.add_edge("GenerateCurriculumRAG", "AskQuestionRAG")
    builder.add_edge("GenerateCurriculumLLM", "AskQuestionLLM")
    
    # End the flow after question generation
    builder.add_edge("AskQuestionRAG", END)
    builder.add_edge("AskQuestionLLM", END)
    
    return builder.compile()

# Create a graph for the answer-question loop (scoring and beyond)
def create_answer_loop_graph():
    builder = StateGraph(InterviewState)
    
    # Add nodes for answer flow
    builder.add_node("ScoreAnswer", score_answer)
    builder.add_node("DecideNext", decide_next)
    builder.add_node("AskQuestionRAG", generate_question_rag)
    builder.add_node("AskQuestionLLM", generate_question_llm)
    builder.add_node("Persona", run_persona)
    
    # Set entry point to score answer
    builder.set_entry_point("ScoreAnswer")
    
    # Connect scoring to decision
    builder.add_edge("ScoreAnswer", "DecideNext")
    
    # Conditional path from decision
    builder.add_conditional_edges(
        "DecideNext",
        lambda s: "Persona" if s.done else ("AskQuestionRAG" if s.use_rag else "AskQuestionLLM")
    )
    
    # Set end point
    builder.add_edge("Persona", END)
    
    return builder.compile()

# Create full graph for backwards compatibility
def create_full_interview_graph():
    builder = StateGraph(InterviewState)
    
    # Add all nodes
    builder.add_node("CheckDocs", check_docs)
    builder.add_node("GenerateCurriculumRAG", generate_curriculum_rag)
    builder.add_node("GenerateCurriculumLLM", generate_curriculum_llm)
    builder.add_node("AskQuestionRAG", generate_question_rag)
    builder.add_node("AskQuestionLLM", generate_question_llm)
    builder.add_node("ScoreAnswer", score_answer)
    builder.add_node("DecideNext", decide_next)
    builder.add_node("Persona", run_persona)
    
    # Set entry point
    builder.set_entry_point("CheckDocs")
    
    # Define all edges
    builder.add_conditional_edges(
        "CheckDocs",
        lambda s: "GenerateCurriculumRAG" if s.use_rag else "GenerateCurriculumLLM"
    )
    builder.add_edge("GenerateCurriculumRAG", "AskQuestionRAG")
    builder.add_edge("GenerateCurriculumLLM", "AskQuestionLLM")
    builder.add_edge("AskQuestionRAG", "ScoreAnswer")
    builder.add_edge("AskQuestionLLM", "ScoreAnswer")
    builder.add_edge("ScoreAnswer", "DecideNext")
    builder.add_conditional_edges(
        "DecideNext",
        lambda s: "Persona" if s.done else ("AskQuestionRAG" if s.use_rag else "AskQuestionLLM")
    )
    builder.add_edge("Persona", END)
    
    return builder.compile()

# Compile all graphs
initial_question_graph = create_initial_question_graph()
answer_loop_graph = create_answer_loop_graph()
interview_graph = create_full_interview_graph()  # For backwards compatibility
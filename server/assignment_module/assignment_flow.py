import uuid
from typing import TypedDict, List, Dict, Any, Optional
from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field as PydanticField
from langgraph.graph import StateGraph, END

from . import assignment_crud as crud
from .assignment_schema import Question, SubtopicResponse,EvolvedPersona, QuestionFeedback, UserResponse

# --- 1. Define Graph State ---

class AssignmentState(TypedDict):
    study_id: str
    assignment_level: str
    chapter_idx: int
    subtopic_idx: Optional[int]
    llm: BaseChatModel
    persona: Dict[str, Any]
    lesson_plan: Dict[str, Any]
    source_content: Optional[str]
    source_questions: Optional[List[str]]
    current_chapter_outcome: Optional[str]
    current_subtopic_outcome: Optional[str]
    generated_questions: List[Question]
    user_responses: List[UserResponse]
    ground_truth_questions: List[Dict[str, Any]]
    feedback_list: List[Dict[str, Any]]
    overall_score: float
    assignment_doc: Dict[str, Any]
    performance_summary: str
    evolved_persona: EvolvedPersona

# --- 2. Define LLM ---

def get_llm():
    # Ensure GOOGLE_API_KEY is in your environment variables
    return ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.2)

# --- 3. Define Graph Nodes ---

def fetch_data_for_generation(state: AssignmentState) -> AssignmentState:
    study_id = state["study_id"]
    level = state["assignment_level"]
    chapter_idx = state["chapter_idx"]
    subtopic_idx = state["subtopic_idx"]
    
    state["persona"] = crud.get_persona(study_id)
    
    # FIX: Always fetch lesson plan and navigate strictly to the nested outcome
    state["lesson_plan"] = crud.get_lesson_plan(study_id)
    try:
        # lesson_plan_doc -> "lesson_plan" -> "chapters" -> [idx]
        plan_details = state["lesson_plan"].get("lesson_plan", {})
        current_chapter = plan_details.get("chapters", [])[chapter_idx]
        
        state["current_chapter_outcome"] = current_chapter.get("chapter_outcome")
        # Subtopics are strings in your JSON, so we don't have granular outcomes for them yet
        state["current_subtopic_outcome"] = None 
            
    except (IndexError, KeyError, TypeError) as e:
        print(f"Warning: Could not extract outcomes: {e}")
        state["current_chapter_outcome"] = None
        state["current_subtopic_outcome"] = None
    
    if level == "subtopic":
        # FIX: Pass chapter_idx to match the per-chapter content storage
        content_doc = crud.get_generated_content(study_id, chapter_idx)
        try:
            # generated_content is a list of objects. We access by index.
            content_list = content_doc.get("generated_content", [])
            source_content = content_list[subtopic_idx]["content"]
            state["source_content"] = source_content
        except (IndexError, KeyError, TypeError):
            raise Exception(f"Could not find content for chapter {chapter_idx}, subtopic {subtopic_idx}")
    
    elif level == "chapter" or level == "subject":
        assignment_doc = crud.get_assignment_doc(study_id)
        source_questions = []
        if level == "chapter":
            for quiz in assignment_doc["chapters"][chapter_idx]["subtopic_quizzes"]:
                source_questions.extend(quiz.get("questions", []))
        else: # "subject"
            for chapter in assignment_doc["chapters"]:
                source_questions.extend(chapter["chapter_level_assignment"].get("questions", []))
        
        if not source_questions:
            raise Exception(f"No source questions found to generate {level} assignment.")
            
        state["source_questions"] = [f"Type: {q['question_type']}, Question: {q['question_text']}" for q in source_questions]
    
    return state

# server/assignment_module/assignment_flow.py

def generate_assignment_llm(state: AssignmentState) -> AssignmentState:
    llm = state["llm"]
    level = state["assignment_level"]
    
    persona_summary = state["persona"].get("learner_profile_summary", "a general learner")
    structured_llm = llm.with_structured_output(SubtopicResponse) # Ensure this matches your Schema import!
    
    prompt_template = ""
    prompt_input = {}
    
    if level == "subtopic":
        prompt_template = """
        You are an expert quiz designer. Create a 5-question quiz.
        The user's profile is: <persona>{persona}</persona>
        Learning Outcome: "{outcome}" (The quiz MUST verify this specific goal).
        The source content is: <content>{content}</content>
        
        Generate exactly 5 questions:
        - 3 Multiple Choice Questions (mcq)
        - 1 Fill-in-the-Blank (fill_in_blank)
        - 1 Open-Ended (open_ended).
        
        For each question:
        - Provide a unique `question_id` (use a placeholder).
        - For 'mcq', provide 3-4 options and the `id` of the correct one.
        - For 'fill_in_blank', the `correct_answer` is the exact word(s).
        - For 'open_ended', the `correct_answer` should be a "model answer" and you MUST provide a detailed `rubric`.
        - Provide a clear `explanation`.
        """
        # --- FIX IS HERE: Added "outcome" to the input ---
        prompt_input = {
            "persona": persona_summary, 
            "content": state["source_content"],
            "outcome": state.get("current_subtopic_outcome") or "Understand the key concepts of this section" 
        }
        
    elif level == "chapter":
        prompt_template = """
        You are an expert educator. A user has completed a chapter.
        Main Chapter Outcome: <outcome>{outcome}</outcome>
        Previous questions they answered: <previous>{questions}</previous>
        
        Create a 2-part 'chapter-level assignment' (open-ended) that forces synthesis and application of the chapter outcome.
        1. Analytical scenario.
        2. Creative/Practical application.
        """
        prompt_input = {
            "persona": persona_summary, 
            "questions": "\n".join(state["source_questions"]),
            "outcome": state.get("current_chapter_outcome") or "Synthesize chapter concepts"
        }
        
    elif level == "subject":
        prompt_template = """
        You are designing a final capstone project.
        Create 1 comprehensive 'open_ended' task (e.g., design document, project plan) integrating all previous concepts.
        """
        prompt_input = {
            "persona": persona_summary, 
            "questions": "\n".join(state["source_questions"])
        }
        
    prompt = ChatPromptTemplate.from_template(prompt_template)
    chain = prompt | structured_llm
    response = chain.invoke(prompt_input)
    
    # Handle the response wrapper logic (Schema dependent)
    generated_questions = response.questions 
    
    for q in generated_questions:
        q.question_id = str(uuid.uuid4())
        
    state["generated_questions"] = generated_questions
    return state

def fetch_data_for_scoring(state: AssignmentState) -> AssignmentState:
    study_id = state["study_id"]
    level = state["assignment_level"]
    chapter_idx = state["chapter_idx"]
    subtopic_idx = state["subtopic_idx"]
    
    assignment_doc = crud.get_assignment_doc(study_id)
    
    questions = []
    if level == "subtopic":
        questions = assignment_doc["chapters"][chapter_idx]["subtopic_quizzes"][subtopic_idx]["questions"]
    elif level == "chapter":
        questions = assignment_doc["chapters"][chapter_idx]["chapter_level_assignment"]["questions"]
    elif level == "subject":
        questions = assignment_doc["subject_level_assignment"]["questions"]
        
    state["ground_truth_questions"] = questions
    return state

class GraderOutput(BaseModel):
    score: int = PydanticField(..., ge=0, le=10)
    feedback: str

def score_answers(state: AssignmentState) -> AssignmentState:
    user_responses = state["user_responses"]
    ground_truth_questions = state["ground_truth_questions"]
    llm = state["llm"]
    
    grader_llm = llm.with_structured_output(GraderOutput)
    grader_prompt = ChatPromptTemplate.from_template(
        "Grade this answer. Question: {question}. Rubric: {rubric}. Answer: {answer}. Provide score (0-10) and feedback."
    )
    grader_chain = grader_prompt | grader_llm
    
    feedback_list = []
    total_score = 0.0
    
    for user_res in user_responses:
        gt_question = next((q for q in ground_truth_questions if q["question_id"] == user_res.question_id), None)
        if not gt_question: continue

        q_type = gt_question["question_type"]
        is_correct = False
        feedback = ""
        score = 0.0
        
        if q_type in ["mcq", "fill_in_blank"]:
            is_correct = (str(user_res.user_answer).lower() == str(gt_question["correct_answer"]).lower())
            score = 10.0 if is_correct else 0.0
            feedback = "Correct!" if is_correct else f"Incorrect. {gt_question['explanation']}"
        elif q_type == "open_ended":
            try:
                grade = grader_chain.invoke({
                    "question": gt_question["question_text"],
                    "rubric": gt_question["rubric"],
                    "answer": user_res.user_answer
                })
                score = float(grade.score)
                feedback = grade.feedback
                is_correct = (score >= 7.0)
            except Exception:
                score = 0.0
                feedback = "Error grading."
        
        total_score += score
        feedback_list.append(
            QuestionFeedback(
                question_id=user_res.question_id,
                user_answer=user_res.user_answer,
                correct_answer=gt_question["correct_answer"],
                is_correct=is_correct,
                feedback=feedback,
                explanation=gt_question["explanation"]
            ).model_dump()
        )
        
    state["feedback_list"] = feedback_list
    state["overall_score"] = (total_score / (len(user_responses) * 10.0)) * 100.0 if user_responses else 0.0
    return state

def fetch_data_for_evolution(state: AssignmentState) -> AssignmentState:
    study_id = state["study_id"]
    state["lesson_plan"] = crud.get_lesson_plan(study_id)
    state["persona"] = crud.get_persona(study_id)
    state["assignment_doc"] = crud.get_assignment_doc(study_id)
    return state

def analyze_performance(state: AssignmentState) -> AssignmentState:
    chapter_idx = state["chapter_idx"]
    assignment_doc = state["assignment_doc"]
    try:
        chapter_data = assignment_doc["chapters"][chapter_idx]
        l1_scores = [quiz.get("score") for quiz in chapter_data["subtopic_quizzes"] if quiz.get("score") is not None]
        l1_avg = sum(l1_scores) / len(l1_scores) if l1_scores else 0
        l2_score = chapter_data["chapter_level_assignment"].get("overall_score", 0)
        
        summary = f"Chapter '{chapter_data['chapter_title']}'. L1 Avg: {l1_avg}%. L2 Score: {l2_score}%."
        state["performance_summary"] = summary
    except Exception:
        state["performance_summary"] = "Error analyzing performance."
    return state

def evolve_persona_llm(state: AssignmentState) -> AssignmentState:
    llm = state["llm"]
    structured_llm = llm.with_structured_output(EvolvedPersona)
    
    prompt = ChatPromptTemplate.from_template(
        "Update persona based on performance. Old Persona: {persona}. Performance: {performance}. Next Chapter: {next_chapter}."
    )
    chain = prompt | structured_llm
    
    try:
        # Navigate the nested lesson plan structure again for the next chapter
        chapters = state["lesson_plan"]["lesson_plan"]["chapters"]
        if state["chapter_idx"] + 1 < len(chapters):
            next_chapter_title = chapters[state["chapter_idx"] + 1]["chapter_title"]
        else:
            next_chapter_title = "None"
    except:
        next_chapter_title = "Unknown"

    state["evolved_persona"] = chain.invoke({
        "persona": state["persona"].get("learner_profile_summary", ""),
        "performance": state["performance_summary"],
        "next_chapter": next_chapter_title
    })
    return state

# --- 4. Define Graphs ---

def create_generation_graph():
    builder = StateGraph(AssignmentState)
    builder.add_node("fetch_data", fetch_data_for_generation)
    builder.add_node("generate_llm", generate_assignment_llm)
    builder.set_entry_point("fetch_data")
    builder.add_edge("fetch_data", "generate_llm")
    builder.add_edge("generate_llm", END)
    return builder.compile()

def create_scoring_graph():
    builder = StateGraph(AssignmentState)
    builder.add_node("fetch_ground_truth", fetch_data_for_scoring)
    builder.add_node("score_answers", score_answers)
    builder.set_entry_point("fetch_ground_truth")
    builder.add_edge("fetch_ground_truth", "score_answers")
    builder.add_edge("score_answers", END)
    return builder.compile()

def create_evolution_graph():
    builder = StateGraph(AssignmentState)
    builder.add_node("fetch_all_data", fetch_data_for_evolution)
    builder.add_node("analyze_performance", analyze_performance)
    builder.add_node("evolve_persona_llm", evolve_persona_llm)
    builder.set_entry_point("fetch_all_data")
    builder.add_edge("fetch_all_data", "analyze_performance")
    builder.add_edge("analyze_performance", "evolve_persona_llm")
    builder.add_edge("evolve_persona_llm", END)
    return builder.compile()
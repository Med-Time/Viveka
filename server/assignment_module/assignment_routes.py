# server/assignment_module/assignment_routes.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from auth.services import get_current_user
from typing import Dict, Any
from bson import ObjectId  # <--- Need this to convert string ID to MongoDB ID

# FIX: Import 'user' directly from your mongo.py
from core.mongo import user 

from .assignment_schema import (
    SubtopicResponse,
    ChapterResponse,
    SubjectCompletionResponse,
    SubmitAssignmentRequest, SubmitAssignmentResponse
)
from . import assignment_crud as crud
from .assignment_flow import (
    get_llm,
    create_generation_graph, 
    create_scoring_graph, 
    create_evolution_graph
)

router = APIRouter(prefix="/iiismart-assignment", tags=["assignment"])

# --- Initialize LLM and Graphs on startup ---
llm = get_llm()
generation_graph = create_generation_graph()
scoring_graph = create_scoring_graph()
evolution_graph = create_evolution_graph()

# --- Security Dependency ---
def verify_study_id_access(study_id: str, user_id: str = Depends(get_current_user)) -> Dict[str, Any]:
    """
    1. Takes the user_id string from the token (get_current_user).
    2. Fetches the full user document from MongoDB using the 'user' collection.
    3. Verifies the study_id exists in their 'studies' list.
    """
    # FIX: Use the 'user' collection from mongo.py
    try:
        user_doc = user.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid User ID format")

    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")

    # Now user_doc is a real dictionary, so .get() will work
    user_studies = user_doc.get("studies", [])
    
    if not any(s["study_id"] == study_id for s in user_studies):
        raise HTTPException(status_code=403, detail="User not authorized for this study_id")
    
    return user_doc

# --- Background Task for Persona Evolution ---
def run_persona_evolution(study_id: str, chapter_idx: int):
    try:
        initial_state = {
            "study_id": study_id,
            "chapter_idx": chapter_idx,
            "llm": llm
        }
        final_state = evolution_graph.invoke(initial_state)
        evolved_persona = final_state["evolved_persona"]
        crud.save_evolved_persona(study_id, evolved_persona)
        print(f"Successfully evolved persona for study_id: {study_id}")
    except Exception as e:
        print(f"Error during persona evolution for {study_id}: {e}")

# --- Generation Endpoints ---

@router.post("/subtopic/{study_id}/{chapter_idx}/{subtopic_idx}", response_model=SubtopicResponse)
def subtopic_assignment(
    study_id: str, 
    chapter_idx: int, 
    subtopic_idx: int, 
    user_doc: Dict[str, Any] = Depends(verify_study_id_access) # Injects the full user document
):
    try:
        # Use the ID string from the document we just fetched
        crud.get_or_create_assignment_doc(study_id, str(user_doc["_id"]))

        existing_doc = crud.get_assignment_doc(study_id)
        try:
            # Navigate to the specific quiz
            chapter = existing_doc["chapters"][chapter_idx]
            quiz = chapter["subtopic_quizzes"][subtopic_idx]
            
            # If questions exist and status is NOT 'completed', return them (Resume Mode)
            if quiz.get("questions") and len(quiz["questions"]) > 0:
                print(f"Resuming existing quiz for {study_id}...")
                return SubtopicResponse(questions=quiz["questions"])
        except (IndexError, KeyError):
            pass # Data doesn't exist yet, proceed to generation
        # -----------------------------------
        
        initial_state = {
            "study_id": study_id,
            "assignment_level": "subtopic",
            "chapter_idx": chapter_idx,
            "subtopic_idx": subtopic_idx,
            "llm": llm
        }
        
        final_state = generation_graph.invoke(initial_state)
        questions = final_state["generated_questions"]
        
        crud.save_questions_to_db(study_id, "subtopic", chapter_idx, subtopic_idx, questions)
        
        return SubtopicResponse(questions=questions)
        
    except Exception as e:
        print(f"Error in subtopic assignment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chapter/{study_id}/{chapter_idx}", response_model=ChapterResponse)
def chapter_assignment(
    study_id: str,
    chapter_idx: int, 
    user_doc: Dict[str, Any] = Depends(verify_study_id_access)
):
    try:
        crud.get_or_create_assignment_doc(study_id, str(user_doc["_id"]))

        # --- RESUME CHECK (New Logic) ---
        existing_doc = crud.get_assignment_doc(study_id)
        try:
            chapter_assignment = existing_doc["chapters"][chapter_idx]["chapter_level_assignment"]
            if chapter_assignment.get("questions") and len(chapter_assignment["questions"]) > 0:
                print(f"Resuming existing chapter assignment for {study_id}...")
                return ChapterResponse(questions=chapter_assignment["questions"])
        except (IndexError, KeyError):
            pass 
        # -----------------------------------

        initial_state = {
            "study_id": study_id,
            "assignment_level": "chapter",
            "chapter_idx": chapter_idx,
            "subtopic_idx": None,
            "llm": llm
        }
        
        final_state = generation_graph.invoke(initial_state)
        questions = final_state["generated_questions"]
        
        crud.save_questions_to_db(study_id, "chapter", chapter_idx, None, questions)
        
        return ChapterResponse(questions=questions)
        
    except Exception as e:
        print(f"Error in chapter assignment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/subject/{study_id}', response_model=SubjectCompletionResponse)
def subject_completion(
    study_id: str,
    user_doc: Dict[str, Any] = Depends(verify_study_id_access)
):
    try:
        crud.get_or_create_assignment_doc(study_id, str(user_doc["_id"]))
        
        initial_state = {
            "study_id": study_id,
            "assignment_level": "subject",
            "chapter_idx": 0, 
            "subtopic_idx": None,
            "llm": llm
        }
        
        final_state = generation_graph.invoke(initial_state)
        questions = final_state["generated_questions"]
        
        crud.save_questions_to_db(study_id, "subject", 0, None, questions)
        
        return SubjectCompletionResponse(questions=questions)
        
    except Exception as e:
        print(f"Error in subject assignment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Submission Endpoint ---

@router.post("/submit/{study_id}", response_model=SubmitAssignmentResponse)
def submit_assignment(
    study_id: str,
    req: SubmitAssignmentRequest,
    background_tasks: BackgroundTasks,
    user_doc: Dict[str, Any] = Depends(verify_study_id_access)
):
    try:
        initial_state = {
            "study_id": study_id,
            "assignment_level": req.assignment_level,
            "chapter_idx": req.chapter_idx,
            "subtopic_idx": req.subtopic_idx,
            "user_responses": req.responses,
            "llm": llm
        }
        
        # Run the scoring graph
        final_state = scoring_graph.invoke(initial_state)
        feedback_list = final_state["feedback_list"]
        overall_score = final_state["overall_score"]
        
        # Save results to DB
        crud.save_responses_to_db(
            study_id,
            req.assignment_level,
            req.chapter_idx,
            req.subtopic_idx,
            feedback_list,
            overall_score
        )
        
        # --- THE EVOLUTION TRIGGER ---
        if req.assignment_level == "chapter":
            background_tasks.add_task(
                run_persona_evolution, 
                study_id=study_id, 
                chapter_idx=req.chapter_idx
            )
            
        return SubmitAssignmentResponse(
            overall_score=overall_score,
            feedback_list=feedback_list
        )
        
    except Exception as e:
        print(f"Error in submit assignment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
# Make sure 'assignments_col' is exported from your core.mongo
from core.mongo import (
    lesson_plan, 
    persona_col, 
    generated_content_col, 
    assignments_col 
)
from .assignment_schema import Question, EvolvedPersona
from typing import List, Dict, Any, Optional
import uuid

# --- Helper to create the assignment doc ---
def get_or_create_assignment_doc(study_id: str, user_id: str) -> Dict[str, Any]:
    """
    Finds the single assignment document for a study_id.
    If it doesn't exist, it creates it using the lesson_plan as a template.
    """
    # Use a distinct variable name to avoid shadowing the import
    assignment_doc = assignments_col.find_one({"study_id": study_id})
    if assignment_doc:
        return assignment_doc

    # Fetch the lesson plan document
    lesson_plan_doc = lesson_plan.find_one({"study_id": study_id})
    if not lesson_plan_doc:
        raise Exception(f"No lesson_plan found for study_id {study_id} to create assignment doc.")

    # FIX: Drill down into the nested "lesson_plan" object
    plan_details = lesson_plan_doc.get("lesson_plan", {})
    chapters_data = plan_details.get("chapters", [])

    chapters_template = []
    for chapter in chapters_data:
        subtopics_template = []
        
        # FIX: Handle "sub_topics" as a list of strings (matches your JSON)
        for subtopic_title in chapter.get("sub_topics", []):
            subtopics_template.append({
                "subtopic_title": subtopic_title, 
                "content_ref": str(uuid.uuid4()), 
                "status": "pending",
                "questions": [],
                "score": None
            })
        
        chapters_template.append({
            "chapter_title": chapter.get("chapter_title", "Unknown Chapter"),
            "status": "pending",
            "subtopic_quizzes": subtopics_template,
            "chapter_level_assignment": {
                "title": f"Chapter Assignment: {chapter.get('chapter_title', '')}",
                "status": "pending",
                "questions": [],
                "overall_score": None
            }
        })

    new_assignment_doc = {
        "study_id": study_id,
        "user_id": user_id,
        "subject_title": lesson_plan_doc.get("subject", "Unknown Subject"),
        "status": "in_progress",
        "created_at": lesson_plan_doc.get("created_at"),
        "updated_at": lesson_plan_doc.get("created_at"),
        "chapters": chapters_template,
        "subject_level_assignment": {
            "title": f"Final Project: {lesson_plan_doc.get('subject', '')}",
            "status": "pending",
            "questions": [],
            "overall_score": None
        }
    }
    
    assignments_col.insert_one(new_assignment_doc)
    return new_assignment_doc

# --- Fetch Functions ---

def get_lesson_plan(study_id: str) -> Dict[str, Any]:
    doc = lesson_plan.find_one({"study_id": study_id})
    if not doc:
        raise Exception(f"Lesson plan not found for study_id: {study_id}")
    return doc

def get_persona(study_id: str) -> Dict[str, Any]:
    doc = persona_col.find_one({"study_id": study_id})
    if not doc:
        return {"learner_profile_summary": "No persona found. Using default.", "next_chapter_directives": []}
    return doc

def get_generated_content(study_id: str, chapter_idx: int) -> Dict[str, Any]:
    """
    FIX: Query by both study_id AND chapter_idx because your 
    generated_content is stored one document per chapter.
    """
    doc = generated_content_col.find_one({
        "study_id": study_id,
        "chapter_idx": chapter_idx
    })
    if not doc:
        raise Exception(f"Generated content not found for study_id: {study_id} and chapter_idx: {chapter_idx}")
    return doc

def get_assignment_doc(study_id: str) -> Dict[str, Any]:
    doc = assignments_col.find_one({"study_id": study_id})
    if not doc:
        raise Exception(f"Assignment document not found. Call get_or_create first.")
    return doc

# --- Update Functions ---

def save_questions_to_db(study_id: str, level: str, chapter_idx: int, subtopic_idx: Optional[int], questions: List[Question]):
    questions_as_dict = [q.model_dump() for q in questions]
    
    if level == "subtopic":
        target_field = f"chapters.{chapter_idx}.subtopic_quizzes.{subtopic_idx}.questions"
        status_field = f"chapters.{chapter_idx}.subtopic_quizzes.{subtopic_idx}.status"
        update = {"$set": {target_field: questions_as_dict, status_field: "pending"}}
    elif level == "chapter":
        target_field = f"chapters.{chapter_idx}.chapter_level_assignment.questions"
        status_field = f"chapters.{chapter_idx}.chapter_level_assignment.status"
        update = {"$set": {target_field: questions_as_dict, status_field: "pending"}}
    elif level == "subject":
        target_field = "subject_level_assignment.questions"
        status_field = "subject_level_assignment.status"
        update = {"$set": {target_field: questions_as_dict, status_field: "pending"}}
    else:
        raise ValueError("Invalid assignment level")

    assignments_col.update_one({"study_id": study_id}, update)

def save_responses_to_db(study_id: str, level: str, chapter_idx: int, subtopic_idx: Optional[int], feedback_list: List[Dict[str, Any]], overall_score: float):
    if level == "subtopic":
        base_path = f"chapters.{chapter_idx}.subtopic_quizzes.{subtopic_idx}"
        for fb in feedback_list:
            assignments_col.update_one(
                {"study_id": study_id, f"{base_path}.questions.question_id": fb["question_id"]},
                {"$set": {
                    f"{base_path}.questions.$.user_response": fb["user_answer"],
                    f"{base_path}.questions.$.is_correct": fb["is_correct"],
                    f"{base_path}.questions.$.feedback": fb["feedback"]
                }}
            )
        assignments_col.update_one(
            {"study_id": study_id},
            {"$set": {f"{base_path}.status": "completed", f"{base_path}.score": overall_score}}
        )
        
    elif level == "chapter":
        base_path = f"chapters.{chapter_idx}.chapter_level_assignment"
        for fb in feedback_list:
             assignments_col.update_one(
                {"study_id": study_id, f"{base_path}.questions.question_id": fb["question_id"]},
                {"$set": {
                    f"{base_path}.questions.$.user_response": fb["user_answer"],
                    f"{base_path}.questions.$.is_correct": fb["is_correct"],
                    f"{base_path}.questions.$.feedback": fb["feedback"]
                }}
            )
        assignments_col.update_one(
            {"study_id": study_id},
            {"$set": {
                f"{base_path}.status": "completed",
                f"{base_path}.overall_score": overall_score,
                f"chapters.{chapter_idx}.status": "completed"
            }}
        )

    elif level == "subject":
        base_path = "subject_level_assignment"
        for fb in feedback_list:
             assignments_col.update_one(
                {"study_id": study_id, f"{base_path}.questions.question_id": fb["question_id"]},
                {"$set": {
                    f"{base_path}.questions.$.user_response": fb["user_answer"],
                    f"{base_path}.questions.$.is_correct": fb["is_correct"],
                    f"{base_path}.questions.$.feedback": fb["feedback"]
                }}
            )
        assignments_col.update_one(
            {"study_id": study_id},
            {"$set": {
                f"{base_path}.status": "completed",
                f"{base_path}.overall_score": overall_score,
                "status": "completed"
            }}
        )

def save_evolved_persona(study_id: str, evolved_persona: EvolvedPersona):
    persona_col.update_one(
        {"study_id": study_id},
        {"$set": evolved_persona.model_dump()},
        upsert=True
    )
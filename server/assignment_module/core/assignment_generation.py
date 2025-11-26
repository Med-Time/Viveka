
from assignment_module.assignment_flow import get_llm, create_generation_graph
from assignment_module import assignment_crud as crud


def generate_and_save_assignment(
    study_id: str,
    chapter_idx: int,
    subtopic_idx: int
) -> dict:
    """
    Generate subtopic assignment questions using the generation graph and save to DB.
    
    Called by job_worker after content generation completes.
    
    Returns:
    {
        "assignment_id": str,
        "question_count": int,
        "status": "success"
    }
    """
    try:
        # Initialize LLM and graph
        llm = get_llm()
        generation_graph = create_generation_graph()

        # Get or create assignment doc if not exists
        crud.get_or_create_assignment_doc(study_id, study_id)  # Use study_id as user_id for background task

        # Check if assignment already exists (resume check)
        existing_doc = crud.get_assignment_doc(study_id)
        try:
            chapter = existing_doc["chapters"][chapter_idx]
            quiz = chapter["subtopic_quizzes"][subtopic_idx]
            
            # If questions exist, don't regenerate (idempotent)
            if quiz.get("questions") and len(quiz["questions"]) > 0:
                print(f"Assignment already exists for {study_id}:{chapter_idx}:{subtopic_idx}, skipping regeneration")
                return {
                    "assignment_id": str(quiz.get("_id", "")),
                    "question_count": len(quiz["questions"]),
                    "status": "already_exists"
                }
        except (IndexError, KeyError):
            pass  # Assignment doesn't exist yet, proceed to generation

        # Invoke generation graph for subtopic-level assignment
        initial_state = {
            "study_id": study_id,
            "assignment_level": "subtopic",
            "chapter_idx": chapter_idx,
            "subtopic_idx": subtopic_idx,
            "llm": llm
        }

        final_state = generation_graph.invoke(initial_state)
        questions = final_state.get("generated_questions", [])

        if not questions:
            raise RuntimeError("Generation graph returned no questions")

        # Save questions to DB
        crud.save_questions_to_db(
            study_id=study_id,
            level="subtopic",
            chapter_idx=chapter_idx,
            subtopic_idx=subtopic_idx,
            questions=questions
        )
        return {
            "assignment_id": f"{study_id}:{chapter_idx}:{subtopic_idx}",
            "question_count": len(questions),
            "status": "success"
        }

    except Exception as e:
        print(f"Error in generate_and_save_assignment for {study_id}:{chapter_idx}:{subtopic_idx}: {str(e)}")
        raise  # Re-raise so worker can log the error
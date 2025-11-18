from datetime import datetime
from fastapi import APIRouter, HTTPException
from bson import ObjectId
from content_module.core.mongo import sessions_col, lesson_plans
from content_module.core.mongo_fetch import fetch_generated_content
from content_module.core.mongo_persistence import save_generated_content
from content_module.langgraph_flow.content_graph import graph
from content_module.schemas import ContentInput, ContentResponse, ProgressInput

router = APIRouter(
    prefix="/content",
    tags=["content"]
)

@router.get("/generate/{study_id}/{chapter_idx}")
async def generate_content_route(study_id: str, chapter_idx: int):
    """
    Generate content for a specific chapter and save it to the database.
    """
    try:
        study_data = sessions_col.find_one({"_id": ObjectId(study_id)})
        if not study_data:
            raise HTTPException(status_code=404, detail="study not found")
        study_data["_id"] = str(study_data["_id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid study ID: {str(e)}")
    
    state = ContentInput(
        study_id=study_id,
        user_id=study_data.get("user_id"),
        chapter_idx=chapter_idx,
        chapter_title="",
        subtopic_title="",
        generated_content=[],
        content_grade=None,
        content_feedback="",
        average_score=0.0,
        retry_count=0,
        max_retries=3,
        error=None
    )

    
    print(f"Starting content generation for study: {study_id}, chapter: {chapter_idx}")
    try:
        result = graph.invoke(state)

        response_data = ContentResponse(
            study_id=study_id,
            user_id= study_data.get("user_id"),
            chapter_idx= chapter_idx,
            chapter_title= result["chapter_title"],
            generated_content= result["generated_content"],
        )

        response = response_data.model_dump()
        try:
            content_id = save_generated_content(response_data)
            response["content_id"] = content_id
            print(f'Response data: {response}')
        except Exception as e:
            response["save_error"] = str(e)
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating content: {str(e)}")

@router.get("/{study_id}/{chapter_idx}")
async def get_generated_content(study_id: str, chapter_idx: int):
    """
    Retrieve the saved content for a specific study and chapter.
    """
    try:
        content = fetch_generated_content(study_id, chapter_idx)
        if not content:
            raise HTTPException(status_code=404, detail="No content found. Generate first.")
        content.pop("_id", None)  # Remove MongoDB internal ID
        content.pop("created_at", None)  # Remove created_at if not needed
        response_data = ContentResponse(**content)
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving content: {str(e)}")
    
@router.get("/{study_id}/{chapter_idx}/{index}")
async def get_generated_content_by_subtopic(study_id: str, chapter_idx: int, index: int):
    """
    Retrieve the saved content for a specific study, chapter, and subtopic index.
    """
    try:
        content = fetch_generated_content(study_id, chapter_idx)
        if not content:
            raise HTTPException(status_code=404, detail="No content found. Generate first.")
        content.pop("_id", None)  # Remove MongoDB internal ID
        content.pop("created_at", None)  # Remove created_at if not needed
        response_data = ContentResponse(**content)
        generated_list = response_data.generated_content  # List[SubtopicContent]

        # Validate index and return requested subtopic
        if not generated_list or index < 0 or index >= len(generated_list):
            raise HTTPException(status_code=404, detail="Subtopic not found for given index.")

        subtopic = generated_list[index]
        # support both Pydantic model and plain dict
        title = getattr(subtopic, "title", None)
        body = getattr(subtopic, "content", None)

        return {"title": title, "content": body}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving content: {str(e)}")

@router.post("/progress/complete_subtopic")
def mark_subtopic_complete(data: ProgressInput):
    study_id = data.study_id
    c_idx = data.chapter_idx
    s_idx = data.subtopic_idx

    # Build filter to find the document containing the study_id
    filter_doc = {"study_id": study_id}

    update = {
        "$set": {
            f"lesson_plan.chapters.{c_idx}.sub_topics.{s_idx}.completed": True,
            f"lesson_plan.chapters.{c_idx}.sub_topics.{s_idx}.completed_at": datetime.utcnow()
        }
    }

    # Try to update the document
    result = lesson_plans.update_one(filter_doc, update)

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lesson plan not found for study_id")

    if result.modified_count == 0:
        # Possibly the fields were already set, still return ok
        return {"status": "ok", "message": "No change (already completed)"}

    return {"status": "ok", "study_id": data.study_id, "chapter_idx": data.chapter_idx, "subtopic_idx": data.subtopic_idx, "message": "Subtopic marked as completed."}
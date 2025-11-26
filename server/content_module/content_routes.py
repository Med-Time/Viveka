from datetime import datetime
from fastapi import APIRouter, HTTPException
from core.mongo import sessions_col, lesson_plan
from content_module.core.mongo_fetch import fetch_generated_content, fetch_content_subtopic
from content_module.core.mongo_persistence import save_generated_content
from content_module.langgraph_flow.content_graph import graph
from content_module.schemas import ContentInput, ContentResponse, ProgressInput, SubtopicContent
from core.mongo import generation_jobs
from bson import ObjectId
from content_module.core.generation import generate_and_save_content

router = APIRouter(
    prefix="/content",
    tags=["content"]
)

@router.get("/generate/{study_id}/{chapter_idx}/{index}")
async def generate_content_route(study_id: str, chapter_idx: int, index: int):
    """
    Generate content for a specific chapter and save it to the database.
    """
    try:
        # delegate to shared generator which validates session and saves
        result = generate_and_save_content(study_id, chapter_idx, index)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating content: {str(e)}")

@router.get("/job/{job_id}")
async def get_job_status(job_id: str):
    try:
        job = generation_jobs.find_one({"_id": ObjectId(job_id)})
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        job["_id"] = str(job["_id"])
        return job
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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

        # defensive: ensure generated_content exists and index is valid
        generated = content.get("generated_content")
        # If generated is a dict with numbered keys or wrapper, try to normalize to list
        if isinstance(generated, dict):
            # common shape fallback: { "0": {...}, "1": {...} } -> convert to list by numeric keys
            try:
                numeric_keys = sorted([k for k in generated.keys() if k.isdigit()], key=lambda x: int(x))
                generated_list = [generated[k] for k in numeric_keys] if numeric_keys else None
                if generated_list:
                    generated = generated_list
            except Exception:
                generated = None

        if not isinstance(generated, list):
            # if generated isn't a list, try fallback to top-level content array or single item
            if isinstance(content.get("content"), list):
                generated = content.get("content")
            else:
                # single-item fallback: wrap single content into list so index 0 can work
                single_candidate = content.get("generated_content") or content.get("content")
                if isinstance(single_candidate, (str, dict)):
                    generated = [single_candidate]
                else:
                    generated = []

        if index < 0 or index >= len(generated):
            raise HTTPException(status_code=404, detail="Subtopic not found")

        # Now safely build the response using the validated list item
        item = generated[index] or {}
        chapter_title = content.get("chapter_title", "")
        title = item.get("title", item.get("subtopic_title", "")) if isinstance(item, dict) else f"Subtopic {index + 1}"
        body = ""
        if isinstance(item, dict):
            body = item.get("content") or item.get("text") or item.get("body") or ""
        elif isinstance(item, str):
            body = item
        else:
            body = str(item)

        response_data = {
            "chapter_title": chapter_title,
            "title": title,
            "content": body
        }

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving content: {str(e)}")

@router.get("/{study_id}/{chapter_idx}/{subtopic_idx}/references")
async def get_content_references(study_id: str, chapter_idx: int, subtopic_idx: int):
    """
    Fetch references for generated content of a chapter.
    Returns all references from all subtopics in that chapter.
    """
    try:
        from core.mongo import content_col
        
        content = content_col.find_one({
            "study_id": study_id,
            "chapter_idx": int(chapter_idx)
        })
        
        if not content:
            raise HTTPException(status_code=404, detail="No content found for this chapter")
        
        # Collect references from the specified subtopic
        all_refs = []
        generated = content.get("generated_content", [])
        if isinstance(generated, list):
            if 0 <= subtopic_idx < len(generated):
                subtopic = generated[subtopic_idx]
                if isinstance(subtopic, dict):
                    refs = subtopic.get("references", [])
                    if refs:
                        all_refs.extend(refs)
        
        # Deduplicate by URL
        seen_urls = set()
        dedup_refs = []
        for ref in all_refs:
            url = ref.get("url") if isinstance(ref, dict) else None
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)
            dedup_refs.append(ref)
        
        return {"references": dedup_refs, "count": len(dedup_refs)}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving references: {str(e)}")


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
            f"lesson_plan.chapters.{c_idx}.sub_topics.{s_idx}.completed_at": datetime.now()
        }
    }

    # Try to update the document
    result = lesson_plan.update_one(filter_doc, update)

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lesson plan not found for study_id")

    if result.modified_count == 0:
        # Possibly the fields were already set, still return ok
        return {"status": "ok", "message": "No change (already completed)"}

    return {"status": "ok", "study_id": data.study_id, "chapter_idx": data.chapter_idx, "subtopic_idx": data.subtopic_idx, "message": "Subtopic marked as completed."}



@router.post("/enqueue/{study_id}/{chapter_idx}/{index}")
async def enqueue_content_generation(study_id: str, chapter_idx: int, index: int):
    """
    Enqueue content generation job for a given study/chapter/subtopic. Idempotent.
    """
    job_key = f"content:{study_id}:{chapter_idx}:{index}"

    existing = generation_jobs.find_one({"job_key": job_key, "type": "content"})
    if existing and existing.get("status") in ("queued", "processing", "claimed", "partial", "ready"):
        existing["_id"] = str(existing["_id"])
        return {"job_id": str(existing["_id"]), "status": existing.get("status"), "job": existing}

    # naive attempt to grab user_id from session if available
    try:
        sess = sessions_col.find_one({"_id": ObjectId(study_id)})
        user_id = sess.get("user_id") if sess else None
    except Exception:
        user_id = None

    job_doc = {
        "job_key": job_key,
        "type": "content",
        "params": {"study_id": study_id, "chapter_idx": chapter_idx, "subtopic_idx": index, "user_id": user_id},
        "status": "queued",
        "progress": 0,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }
    res = generation_jobs.insert_one(job_doc)
    return {"job_id": str(res.inserted_id), "status": "queued"}
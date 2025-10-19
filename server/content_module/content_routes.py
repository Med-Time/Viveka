from fastapi import APIRouter, HTTPException
from bson import ObjectId
from content_module.core.mongo import sessions_col
from content_module.core.mongo_fetch import fetch_generated_content
from content_module.core.mongo_persistence import save_generated_content
from content_module.langgraph_flow.content_graph import graph

router = APIRouter(
    prefix="/content",
    tags=["content"]
)

@router.get("/generate/{session_id}/{chapter_idx}")
async def generate_content_route(session_id: str, chapter_idx: int):
    """
    Generate content for a specific chapter and save it to the database.
    """
    try:
        session_data = sessions_col.find_one({"_id": ObjectId(session_id)})
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        session_data["_id"] = str(session_data["_id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid session ID: {str(e)}")

    state = {
        "session_id": session_id,
        "user_id": session_data.get("user_id"),
        "chapter_idx": chapter_idx
    }

    try:
        result = graph.invoke(state)

        response_data = {
            "session_id": session_id,
            "user_id": session_data.get("user_id"),
            "chapter_idx": chapter_idx,
            "chapter_title": result["chapter_title"],
            "generated_content": result["generated_content"]
        }

        try:
            content_id = save_generated_content(session_id, response_data)
            response_data["content_id"] = content_id
        except Exception as e:
            response_data["save_error"] = str(e)

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating content: {str(e)}")


@router.get("/{session_id}/{chapter_idx}")
async def get_generated_content(session_id: str, chapter_idx: int):
    """
    Retrieve the saved content for a specific session and chapter.
    """
    try:
        content = fetch_generated_content(session_id, chapter_idx)
        if not content:
            raise HTTPException(status_code=404, detail="No content found. Generate first.")
        return content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving content: {str(e)}")

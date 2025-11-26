from bson import ObjectId
from datetime import datetime

from core.mongo import sessions_col
from content_module.langgraph_flow.content_graph import graph
from content_module.core.mongo_persistence import save_generated_content
from content_module.schemas import ContentInput, ContentResponse


def generate_and_save_content(study_id: str, chapter_idx: int, subtopic_idx: int):
    """
    Generate content for a study/chapter/subtopic using the existing graph
    and persist it via save_generated_content. Returns the saved response dict.
    Raises ValueError on invalid study or RuntimeError on generation failures.
    """
    # fetch session to pull user_id and validate study
    try:
        sess = sessions_col.find_one({"_id": ObjectId(study_id)})
    except Exception as e:
        raise ValueError(f"Invalid study ID: {e}")

    if not sess:
        raise ValueError("study not found")

    user_id = sess.get("user_id")

    state = ContentInput(
        study_id=study_id,
        user_id=user_id,
        chapter_idx=chapter_idx,
        subtopic_idx=subtopic_idx,
        chapter_title="",
        subtopic_title="",
        generated_content=None,
        content_evaluation=None,
        content_grade=None,
        content_feedback="",
        average_score=0.0,
        retry_count=0,
        max_retries=3,
        error=None,
    )

    result = graph.invoke(state)

    response_data = ContentResponse(
        study_id=study_id,
        user_id=user_id,
        chapter_idx=chapter_idx,
        chapter_title=result.get("chapter_title", ""),
        subtopic_idx=subtopic_idx,
        generated_content=result.get("generated_content"),
    )

    # persist and return the saved doc id + response
    content_id = save_generated_content(response_data)
    out = response_data.model_dump()
    out["content_id"] = content_id
    out["saved_at"] = datetime.now().isoformat()
    return out
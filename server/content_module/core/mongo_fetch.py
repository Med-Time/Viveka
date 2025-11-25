from content_module.core.mongo import content_col

def fetch_content_subtopic(study_id: str, chapter_idx: int, index: int):
    """Fetch the most recent generated content for a session and chapter from MongoDB."""
    print(f"Fetching generated content for session: {study_id}, chapter: {chapter_idx}")
    query = {
        "study_id": study_id,
        "chapter_idx": chapter_idx
    }
    content = content_col.find_one(query, sort=[("created_at", -1)])
    if not content:
        print(f"No generated content found for session: {study_id}, chapter: {chapter_idx}")
        return None
    chapter_title = content.get("chapter_title", "")
    print(f"Generated content fetched for session: {study_id}, chapter: {chapter_idx}, index: {index}")
    return content["generated_content"][index] if "generated_content" in content and len(content["generated_content"]) > index else None

def fetch_generated_content(study_id: str, chapter_idx: int):
    """Fetch the most recent generated content for a session and chapter from MongoDB."""
    print(f"Fetching generated content for session: {study_id}, chapter: {chapter_idx}")
    return content_col.find_one(
        {
            "study_id": study_id,
            "chapter_idx": chapter_idx
        },
        sort=[("created_at", -1)]
    )   
from content_module.core.mongo import content_col

def fetch_generated_content(session_id: str, chapter_idx: int):
    """Fetch the most recent generated content for a session and chapter from MongoDB."""
    print(f"Fetching generated content for session: {session_id}, chapter: {chapter_idx}")
    return content_col.find_one(
        {"session_id": session_id, "chapter_idx": chapter_idx},
        sort=[("created_at", -1)]
    )

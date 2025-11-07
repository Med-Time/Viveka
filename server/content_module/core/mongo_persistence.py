from content_module.core.mongo import content_col
from content_module.schemas import ContentResponse

def save_generated_content(session_id: str, data: ContentResponse) -> str:
    """Save generated content to MongoDB and return the content ID."""
    doc = data.model_dump()
    result = content_col.insert_one(doc)
    print(f"Generated content saved with ID: {result.inserted_id}")
    return str(result.inserted_id)

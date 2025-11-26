from pydantic import BaseModel
from core.mongo import content_col
from content_module.schemas import ContentResponse
from datetime import datetime

def save_generated_content(data: ContentResponse) -> str:
    """
    Save generated content to MongoDB.
    """
    query = {
        "study_id": data.study_id,
        "chapter_idx": data.chapter_idx
    }

    # convert Pydantic subtopic to dict (safe for Mongo)
    if isinstance(data.generated_content, BaseModel):
        subtopic_doc = data.generated_content.model_dump()  # pydantic v2
    else:
        # If a plain dict passed, ensure it's serializable
        subtopic_doc = dict(data.generated_content)

    # set or normalize fields we expect
    subtopic_doc.setdefault("title", str(subtopic_doc.get("title", "")))
    subtopic_doc.setdefault("index", int(subtopic_doc.get("index", 0)))
    subtopic_doc.setdefault("content", str(subtopic_doc.get("content", "")))

    existing_doc = content_col.find_one(query)
    if existing_doc:
        # Append to existing generated_content array
        update_result = content_col.update_one(
            query,
            {"$push": {"generated_content": subtopic_doc}}
        )
        print(f"✅ Appended subtopic to existing document: {update_result.modified_count}")
        return str(existing_doc["_id"])

    else:
        # Create a new document
        new_doc = {
            "study_id": data.study_id,
            "user_id": data.user_id,
            "chapter_idx": data.chapter_idx,
            "chapter_title": data.chapter_title,
            "generated_content": [subtopic_doc],
            "created_at": datetime.now()
        }

        result = content_col.insert_one(new_doc)
        print(f"🆕 Created new document with ID: {result.inserted_id}")
        return str(result.inserted_id)

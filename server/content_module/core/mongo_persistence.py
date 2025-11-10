from content_module.core.mongo import content_col
from content_module.schemas import ContentResponse
from datetime import datetime
from bson import ObjectId
from content_module.core.mongo import content_col  # ensure you have this collection

def save_generated_content(data: ContentResponse) -> str:
    """Save generated content to MongoDB and return the content ID."""
    doc = data.model_dump()
    doc["created_at"] = datetime.utcnow()
    result = content_col.insert_one(doc)
    print(f"Generated content saved with ID: {result.inserted_id}")
    return str(result.inserted_id)

# def save_generated_content(data: ContentResponse) -> str:
#     # Normalize generated_content -> list of {index, subtopic_title, content}
#     normalized = []
#     if isinstance(data.generated_content, dict):
#         for i, (k, v) in enumerate(data.generated_content.items()):
#             body = v if isinstance(v, str) else (v.get("content") if isinstance(v, dict) else str(v))
#             normalized.append({"index": i, "subtopic_title": k, "content": body})
#     elif isinstance(data.generated_content, list):
#         for i, item in enumerate(data.generated_content):
#             if isinstance(item, dict):
#                 title = item.get("subtopic_title") or item.get("title") or f"Subtopic {i+1}"
#                 body = item.get("content") or item.get("text") or ""
#             else:
#                 title = f"Subtopic {i+1}"
#                 body = str(item)
#             normalized.append({"index": i, "subtopic_title": title, "content": body})
#     else:
#         normalized = []

#     doc = {
#         "study_id": data.study_id,
#         "user_id": data.user_id,
#         "chapter_idx": data.chapter_idx,
#         "chapter_title": data.chapter_title,
#         "generated_content": normalized,
#         "created_at": datetime.utcnow(),
#     }
#     res = content_col.insert_one(doc)
#     return str(res.inserted_id)

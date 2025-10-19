from content_module.core.mongo import content_col
from datetime import datetime

def save_generated_content(session_id: str, data: dict) -> str:
    data["created_at"] = datetime.now()
    result = content_col.insert_one(data)
    return str(result.inserted_id)

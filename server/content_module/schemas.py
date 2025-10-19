from pydantic import BaseModel
from typing import Dict

class ContentRequest(BaseModel):
    session_id: str
    chapter_idx: int

class ContentResponse(BaseModel):
    session_id: str
    chapter_idx: int
    chapter_title: str
    generated_content: Dict[str, str]

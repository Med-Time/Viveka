from pydantic import BaseModel, Field
from typing import Dict, Optional, Any, Literal, List

# ---------------- Pydantic Models ----------------
class ContentRequest(BaseModel):
    study_id: str
    chapter_idx: int
    subtopic_idx: Optional[int]

class SubtopicEvaluation(BaseModel):
    score: int = Field(..., ge=1, le=10, description="Score from 1-10 for this subtopic.")
    comments: str = Field(..., description="Concise comments on strengths and weaknesses.")
    suggestions: str = Field(..., description="Concrete and actionable suggestions for improvement.")


class SubtopicContent(BaseModel):
    index: int = Field(..., description="0-based index within the chapter.")
    title: str = Field(..., description="Subtopic title.")
    content: str = Field(..., description="Generated content for the subtopic.")
    completed: Optional[bool] = Field(None, description="Completion status of the subtopic.")
    completed_at: Optional[str] = Field(None, description="Timestamp when the subtopic was completed.")


class ContentResponse(BaseModel):
    study_id: str
    user_id: str
    chapter_idx: int
    chapter_title: str
    subtopic_idx: int
    generated_content: SubtopicContent


class ContentInput(BaseModel):
    study_id: str = Field(..., description="The session/user ID")
    user_id: Optional[str] = Field(None, description="The user ID associated with the session")
    chapter_idx: int = Field(..., description="Index of the chapter to generate content for")
    subtopic_idx: int = Field(..., description="Index of the subtopic to generate content for")
    chapter_title: Optional[str] = Field(None, description="Title of the chapter")
    subtopic_title: Optional[str] = Field(None, description="Title of the subtopic")

    generated_content: Optional[SubtopicContent] = Field(None, description="The generated content for the subtopic.")
    content_evaluation:Optional[SubtopicEvaluation] = Field(None, description="Evaluation of the generated content.")
    

    content_grade: Optional[str] = Field(None, description="Overall evaluation grade — 'Good' or 'Bad'.")
    content_feedback: Optional[str] = Field(None, description="Overall evaluation feedback summary.")
    average_score: Optional[float] = Field(None, description="Average score across evaluated subtopics.")

    # -------- Flow Management --------
    retry_count: Optional[int] = Field(0, description="Number of retries attempted so far.")
    max_retries: Optional[int] = Field(3, description="Maximum number of retries allowed for content regeneration.")
    error: Optional[str] = Field(None, description="Error message if any exception occurred during execution.")

    # -------- Dynamic Metadata (optional use) --------
    meta: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional field for additional runtime data (timestamps, tokens, debug info, etc.).",
    )
    class Config:
        arbitrary_types_allowed = True
        extra = "ignore"
        allow_mutation = True
        json_schema_extra = {
            "example": {
                "study_id": "sess_abc123",
                "user_id": "user_001",
                "chapter_idx": 0,
                "chapter_title": "Introduction to Algebra",
                "generated_content": {
                    "Linear Equations": "### Introduction ... (generated content here)"
                },
                "content_evaluations": {},
                "content_grade": None,
                "retry_count": 0,
                "max_retries": 2,
            }
        }

class ContentEvaluation(BaseModel):
    subtopic_title: str = Field(..., description="Title of the subtopic being evaluated.")
    grade: Literal["Good", "Bad"] = Field(..., description="Overall content quality grade.")
    feedback: str = Field(..., description="Summary feedback for the content.")
    evaluation: SubtopicEvaluation = Field(..., description="Subtopic structured evaluations.")
    raw_response: Optional[str] = Field(None, description="Raw LLM response for debugging purposes.")

class ProgressInput(BaseModel):
    user_id: str
    study_id: str
    chapter_idx: int
    subtopic_idx: int
    chapter_title: Optional[str] = None
    subtopic_title: Optional[str] = None
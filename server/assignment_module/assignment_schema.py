from pydantic import BaseModel, Field
from typing import Optional, List, Any, Literal

# --- Core Data Structures ---

class QuestionOption(BaseModel):
    id: str = Field(..., description="A unique identifier for the option, e.g., 'a', 'b', 'c'.")
    text: str = Field(..., description="The text content of the option.")

class Question(BaseModel):
    question_id: str = Field(..., description="A unique UUID for this question.")
    question_type: Literal["mcq", "fill_in_blank", "open_ended"] = Field(..., description="The type of question.")
    question_text: str = Field(..., description="The main text of the question.")
    options: Optional[List[QuestionOption]] = Field(None, description="A list of options, required for 'mcq'.")
    correct_answer: str = Field(..., description="The ID of the correct option (for mcq) or the exact string (for fill_in_blank).")
    explanation: str = Field(..., description="A brief explanation of why the answer is correct.")
    rubric: Optional[str] = Field(None, description="A grading rubric, required for 'open_ended' questions.")

# --- API Request/Response Models ---

# 1. Generation
class SubtopicRequest(BaseModel):
    pass
class ChapterRequest(BaseModel):
    pass
class SubjectCompletionRequest(BaseModel):
    pass

class SubtopicResponse(BaseModel):
    questions: List[Question]

class ChapterResponse(BaseModel):
    questions: List[Question]

class SubjectCompletionResponse(BaseModel):
    questions: List[Question]

# 2. Submission (User sends answers)
class UserResponse(BaseModel):
    question_id: str = Field(..., description="The ID of the question being answered.")
    user_answer: Any = Field(..., description="The user's answer (e.g., 'b' for mcq, 'text' for open-ended).")

class SubmitAssignmentRequest(BaseModel):
    # study_id is in the URL
    assignment_level: Literal["subtopic", "chapter", "subject"]
    chapter_idx: int = Field(..., description="The index of the chapter.")
    subtopic_idx: Optional[int] = Field(None, description="The index of the subtopic (required for subtopic level).")
    responses: List[UserResponse]

# 3. Feedback (API returns scores)
class QuestionFeedback(BaseModel):
    question_id: str
    user_answer: Any
    correct_answer: str
    is_correct: bool
    feedback: str = Field(..., description="Specific feedback for this question.")
    explanation: str = Field(..., description="The original explanation for the correct answer.")

class SubmitAssignmentResponse(BaseModel):
    overall_score: float = Field(..., description="The calculated overall score for this assignment.")
    feedback_list: List[QuestionFeedback]

# --- Evolved Persona Schema (For Structured LLM Output) ---

class EvolvedPersona(BaseModel):
    updated_profile: str = Field(..., description="A concise summary of the learner's current state.")
    next_chapter_directives: List[str] = Field(..., description="Specific commands for the content generator based on performance.")
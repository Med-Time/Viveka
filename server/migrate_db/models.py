# migration_db/models.py

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime
from bson import ObjectId

# --- Cleaned, Embedded Models ---
# These models represent the data *after* we have cleaned all
# redundant/linking IDs from them.

class QAHistoryModel(BaseModel):
    """
    A single Q&A item. 
    Cleaned of _id and study_id.
    """
    concept: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    feedback_history: Optional[List[str]] = Field(default_factory=list)
    score: Optional[int] = None
    retry_count: Optional[int] = None
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(extra="allow")  # Allow other fields if they exist

class PersonaReportModel(BaseModel):
    """
    The persona report.
    Cleaned of _id and study_id.
    """
    type: Optional[str] = None
    created_at: Optional[datetime] = None
    learner_profile_summary: Optional[str] = None
    learning_style_assessment: Optional[List[str]] = Field(default_factory=list)
    strengths: Optional[List[str]] = Field(default_factory=list)
    weaknesses_and_gaps: Optional[List[str]] = Field(default_factory=list)
    common_misconceptions: Optional[List[str]] = Field(default_factory=list)
    engagement_and_confidence: Optional[str] = None
    actionable_learning_recommendations: Optional[List[str]] = Field(default_factory=list)
    preliminary_personalized_roadmap_suggestions: Optional[List[str]] = Field(default_factory=list)
    
    model_config = ConfigDict(extra="allow")

class GeneratedLessonPlanModel(BaseModel):
    """
    The generated lesson plan.
    Cleaned of _id, study_id, user_id, subject, goal, level,
    persona_report_id, and qa_history_ids.
    """
    created_at: Optional[datetime] = None
    lesson_plan: Optional[Dict[str, Any]] = None  # The nested lesson_plan object
    grade: Optional[str] = None
    feedback: Optional[str] = None
    
    model_config = ConfigDict(extra="allow")

# --- Main Schema Models ---

class StudyModel(BaseModel):
    """
    This is the core "Study" or "Session" object.
    It contains all related data for one interview session.
    """
    study_id: str = Field(..., description="The original study_id")
    subject: Optional[str] = None
    goal: Optional[str] = None
    level: Optional[str] = None
    created_at: Optional[datetime] = None
    initial_curriculum: Optional[List[str]] = Field(default_factory=list)
    
    # Embedded Data
    qa_history: List[QAHistoryModel] = Field(default_factory=list)
    persona_report: Optional[PersonaReportModel] = None
    generated_lesson_plan: Optional[GeneratedLessonPlanModel] = None

class UserModel(BaseModel):
    """
    The final, top-level User document.
    The user_id IS the document _id.
    """
    id: str = Field(..., alias="_id", description="The user's unique ID")
    username: Optional[str] = None
    studies: List[StudyModel] = Field(default_factory=list)
    
    # This allows Pydantic to work with MongoDB's _id field
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True
    )
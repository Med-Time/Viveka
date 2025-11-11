from fastapi import APIRouter, Depends, HTTPException
from core.mongo import users
from auth.services import get_current_user
from .assignment_schema import SubtopicRequest, SubtopicResponse, ChapterResponse, ChapterRequest, SubjectCompletionRequest, SubjectCompletionResponse


router = APIRouter(prefix="/iiismart-assignment", tags=["auth"])


@router.post("/subtopic/{chapter_idx}/{subtopic_idx}", response_model=SubtopicResponse)
def subtopic_assignment(req:SubtopicRequest):
    try:
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chapter/{chapter_idx}", response_model=ChapterResponse)
def chapter_assignment(req:ChapterRequest):
    try:
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.post('/subject-completion/{subject_id}', response_model=SubjectCompletionResponse)
def subject_completion(req:SubjectCompletionRequest):
    try:
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
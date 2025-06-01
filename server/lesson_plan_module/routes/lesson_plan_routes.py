from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/lesson-plan",
    tags=["lesson-plan"]
)

@router.get("/")
def get_lesson_plans():
    return {"message": "Lesson plans endpoint"}

@router.post("/generate")
def generate_lesson_plan():
    return {"message": "Lesson plan generation endpoint"}
from fastapi import FastAPI, APIRouter, Depends
from interview_module.routes.interview_routes import router as interview_router
from lesson_plan_module.routes.lesson_plan_routes import router as lesson_plan_router
from migrate_db.migration import router as migrate_router
from content_module.content_routes import router as content_router
from auth.routes import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from auth.services import get_current_user

app = FastAPI()
app.include_router(migrate_router)
app.include_router(auth_router)
app.include_router(interview_router, dependencies=[Depends(get_current_user)], prefix="/interview", tags=["interview"])
app.include_router(lesson_plan_router, dependencies=[Depends(get_current_user)])
app.include_router(content_router, dependencies=[Depends(get_current_user)])

origins = [
    # Add more origins here
    "*",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    print("✅ FastAPI server started. All modules initialized.")

@app.get("/")
def health():
    return {"status": "ok"}
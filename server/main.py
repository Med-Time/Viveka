from fastapi import FastAPI, APIRouter, Depends
from interview_module.routes.interview_routes import router as interview_router
from lesson_plan_module.routes.lesson_plan_routes import router as lesson_plan_router
from migrate_db.migration import router as migrate_router
from content_module.content_routes import router as content_router
from assistant_module.assistant_routes import router as assistant_router
from auth.routes import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from auth.services import get_current_user
from assignment_module.assignment_routes import router as assignment_router
from assignment_module.routes.quiz_status_routes import router as quiz_status_router
from assignment_module.routes import certificate_routes
from core.job_worker import start_worker, stop_worker
app = FastAPI() 
app.include_router(migrate_router)
app.include_router(auth_router)
app.include_router(interview_router, dependencies=[Depends(get_current_user)], prefix="/interview", tags=["interview"])
app.include_router(lesson_plan_router, dependencies=[Depends(get_current_user)])
app.include_router(content_router, dependencies=[Depends(get_current_user)])
app.include_router(assignment_router, dependencies=[Depends(get_current_user)])
app.include_router(quiz_status_router)
app.include_router(certificate_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(assistant_router)

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
    # Start background job worker to process generation jobs
    try:
        start_worker()
        print("✅ Background job worker started.")
    except Exception as e:
        print("❌ Failed to start job worker:", e)

@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 FastAPI server shutting down.")
    stop_worker()

@app.get("/")
def health():
    return {"status": "ok"}
from fastapi import FastAPI
from interview_module.routes.interview_routes import router as interview_router
from lesson_plan_module.routes.lesson_plan_routes import router as lesson_plan_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.include_router(interview_router)
app.include_router(lesson_plan_router)

origins = [
    "http://localhost:5173",
    # Add more origins here
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
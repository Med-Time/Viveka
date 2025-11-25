from fastapi import FastAPI
from routes.interview_routes import router as interview_router
import sys
import os
from interview_module.interview_core.mongo import client  # ensures MongoDB connection is tested at startup
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
app = FastAPI()
app.include_router(interview_router)

@app.on_event("startup")
async def startup_event():
    print("✅ FastAPI server started. MongoDB connection initialized.")

@app.get("/")
def health():
    return {"status": "ok"}

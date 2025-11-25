from pymongo.mongo_client import MongoClient
import os
import certifi
from dotenv import load_dotenv
load_dotenv()

uri = os.getenv("MONGO_URI")

client = MongoClient(uri,tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=5000 )

try:
    client.admin.command('ping')
    print("✅ Successfully connected to MongoDB!")
except Exception as e:
    print("❌ MongoDB connection error:", e)

db = client["interview_ai"]
# This is now the only collection you need for interview data
sessions_col = db["interview_sessions"]
qa_col = db["qa_history"]
persona_col = db["persona_reports"]
lesson_plan = db["lesson_plans"]
user = db["users"]
assignment = db["assignments"]
content_col = db["generated_content"]
assignments_col = db["assignments"]
generated_content_col = db["generated_content"]
# Central collection for background generation jobs
generation_jobs = db["generation_jobs"]
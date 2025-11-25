from pymongo import MongoClient
import os
import certifi
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv("MONGO_URI")

print("Connecting to MongoDB...", uri)
client = MongoClient(uri,tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=5000 )

try:
    client.admin.command('ping')
    print("✅ Successfully connected to MongoDB! from Content Module")
except Exception as e:
    print("❌ MongoDB connection error:", e)

db = client["interview_ai"]  # Your MongoDB database name
sessions_col = db["interview_sessions"]
persona_col = db["persona_reports"]
lesson_plans = db["lesson_plans"]
content_col = db["generated_content"]
generation_jobs = db["generation_jobs"]

    
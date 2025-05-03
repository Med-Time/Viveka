from pymongo.mongo_client import MongoClient
import os

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)

try:
    client.admin.command('ping')
    print("✅ Successfully connected to MongoDB!")
except Exception as e:
    print("❌ MongoDB connection error:", e)

db = client["interview_ai"]  # Your MongoDB database name
sessions_col = db["interview_sessions"]
qa_col = db["qa_history"]
persona_col = db["persona_reports"]
print(db)
print(sessions_col)
print(qa_col)
print(persona_col)

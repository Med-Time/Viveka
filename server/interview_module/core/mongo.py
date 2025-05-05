from pymongo.mongo_client import MongoClient
import os
import certifi
uri = os.getenv("MONGO_URI", MONGO_URI)
client = MongoClient(uri,tlsCAFile=certifi.where(),  
    serverSelectionTimeoutMS=5000 )

try:
    client.admin.command('ping')
    print("✅ Successfully connected to MongoDB!")
except Exception as e:
    print("❌ MongoDB connection error:", e)

db = client["interview_ai"]  # Your MongoDB database name
sessions_col = db["interview_sessions"]
qa_col = db["qa_history"]
persona_col = db["persona_reports"]
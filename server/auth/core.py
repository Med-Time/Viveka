from pymongo import MongoClient
import os
import certifi
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv("MONGO_URI")

client = MongoClient(uri,tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=5000 )


db = client["interview_ai"]

def users_collection():
    return db["users"]

    
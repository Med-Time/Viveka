# migration_db/migration.py

import logging
from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any, List, Optional
from pymongo.errors import BulkWriteError
from pymongo.operations import ReplaceOne

# --- Import your EXISTING database collections ---
# This is the key part. We use your existing connections.
try:
    from interview_module.interview_core.mongo import (
        db, 
        sessions_col, 
        qa_col, 
        persona_col,
        lesson_plans_col as lesson_plan_col
    )
    # from lesson_plan_module.core.mongo import (
    #     lesson_plan as lesson_plan_col
    # )
except ImportError:
    logging.error("Could not import MongoDB collections.")
    # In a real scenario, you might want to handle this more gracefully
    # For this script, we'll assume they exist at runtime.
    raise

# Import our new, clean models
from .models import (
    QAHistoryModel, 
    PersonaReportModel, 
    GeneratedLessonPlanModel, 
    StudyModel, 
    UserModel
)

# --- Define the new 'users' collection ---
users_col = db["users"]

# --- Create the router for your main.py ---
router = APIRouter(
    prefix="/migrate",
    tags=["Database Migration"]
)

# --- Helper Functions for Data Cleaning ---

def _clean_doc(doc: Dict[str, Any], fields_to_remove: List[str]) -> Dict[str, Any]:
    """
    A generic helper to remove specified fields from a document dictionary.
    """
    if doc is None:
        return None
    
    # Use bson.ObjectId if available, otherwise just check for '$oid'
    if "_id" in doc and isinstance(doc["_id"], dict) and "$oid" in doc["_id"]:
        doc["_id"] = str(doc["_id"]["$oid"])
    
    for field in fields_to_remove:
        doc.pop(field, None)
    return doc

# --- Main Migration Endpoint ---

@router.post(
    "/run", 
    summary="Run One-Time Data Migration",
    description="Reads all data from legacy collections and populates the new 'users' collection.",
    status_code=status.HTTP_200_OK
)
async def run_data_migration():
    """
    Performs the full data migration:
    1. Fetches all sessions.
    2. Groups them by user_id.
    3. For each session, fetches and cleans related data (QA, Persona, Lesson Plan).
    4. Assembles a new 'Study' object.
    5. Appends the 'Study' to the correct user.
    6. Uses bulk 'ReplaceOne' to create/update all user documents.
    """
    logging.info("Starting data migration...")
    
    try:
        all_sessions = list(sessions_col.find({}))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch from 'interview_sessions': {e}"
        )
        
    if not all_sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No sessions found in 'interview_sessions' collection to migrate."
        )

    # This map will hold the final, structured data
    users_data_map: Dict[str, Dict[str, Any]] = {}
    processed_sessions = 0
    
    logging.info(f"Found {len(all_sessions)} total sessions to process...")

    for session in all_sessions:
        user_id = session.get("user_id")
        
        # We need the string representation of the BSON ObjectId
        study_id_str = str(session.get("_id")) 
        
        if not user_id:
            logging.warning(f"Skipping session {study_id_str}: No 'user_id' found.")
            continue
            
        # 1. Get or create the main user document in our map
        if user_id not in users_data_map:
            users_data_map[user_id] = {
                "_id": user_id,
                "username": user_id,  # Set username to user_id by default
                "studies": []
            }
        
        # 2. Fetch all related data for this single session
        try:
            qa_docs = list(qa_col.find({"study_id": study_id_str}))
            persona_doc = persona_col.find_one({"study_id": study_id_str})
            lesson_plan_doc = lesson_plan_col.find_one({"study_id": study_id_str})
        except Exception as e:
            logging.error(f"Failed to fetch related data for session {study_id_str}: {e}")
            continue # Skip this session, but continue the migration

        # 3. Clean and Validate the embedded data
        
        # Clean QA History
        clean_qa_list = []
        for doc in qa_docs:
            clean_doc = _clean_doc(doc, ["_id", "study_id"])
            clean_qa_list.append(QAHistoryModel.model_validate(clean_doc).model_dump())
            
        # Clean Persona Report
        clean_persona = None
        if persona_doc:
            clean_doc = _clean_doc(persona_doc, ["_id", "study_id"])
            clean_persona = PersonaReportModel.model_validate(clean_doc).model_dump()
            
        # Clean Lesson Plan
        clean_lesson_plan = None
        if lesson_plan_doc:
            # This is where we remove the most redundant fields
            fields_to_remove = [
                "_id", "study_id", "user_id", "subject", "goal", 
                "level", "persona_report_id", "qa_history_ids", 
                "curriculum_generated"
            ]
            clean_doc = _clean_doc(lesson_plan_doc, fields_to_remove)
            clean_lesson_plan = GeneratedLessonPlanModel.model_validate(clean_doc).model_dump()

        # 4. Assemble the final 'StudyModel' object
        new_study = StudyModel(
            study_id=study_id_str,
            subject=session.get("subject"),
            goal=session.get("goal"),
            level=session.get("level"),
            created_at=session.get("created_at"),
            initial_curriculum=session.get("curriculum"),
            qa_history=clean_qa_list,
            persona_report=clean_persona,
            generated_lesson_plan=clean_lesson_plan
        )
        
        # 5. Add the new study to the user's list
        users_data_map[user_id]["studies"].append(new_study.model_dump())
        processed_sessions += 1

    # 6. Perform the final bulk write to the new 'users' collection
    if not users_data_map:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No valid user data was processed to migrate."
        )
        
    logging.info(f"Assembly complete. Preparing bulk write for {len(users_data_map)} user documents.")
    
    bulk_operations = []
    for user_id, user_doc in users_data_map.items():
        # Validate the final user document
        try:
            UserModel.model_validate(user_doc)
        except Exception as e:
            logging.error(f"Validation failed for user {user_id}: {e}")
            continue # Skip this user
            
        # Add a ReplaceOne operation. This is idempotent.
        # It finds a doc with matching _id and replaces it,
        # or creates it (upsert=True) if it doesn't exist.
        bulk_operations.append(
            ReplaceOne({"_id": user_id}, user_doc, upsert=True)
        )

    if not bulk_operations:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No user documents passed validation. Migration aborted."
        )

    try:
        result = users_col.bulk_write(bulk_operations)
        logging.info("Bulk write successful.")
        
        return {
            "status": "success",
            "message": "Data migration completed successfully.",
            "total_users_processed": len(bulk_operations),
            "processed_sessions": processed_sessions,
            "new_users_created": result.upserted_count,
            "existing_users_updated": result.modified_count,
        }
    except BulkWriteError as bwe:
        logging.error(f"Bulk write error: {bwe.details}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Migration failed during bulk write: {bwe.details}"
        )
    except Exception as e:
        logging.error(f"An unexpected error occurred during bulk write: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}"
        )
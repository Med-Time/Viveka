# server/assistant_module/assistant_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json, traceback
from fastapi.encoders import jsonable_encoder

# Import LLM wrapper (make sure this path matches your file name)
from .ai_assistant import get_assistant_response

# Import your existing services
from content_module.core.mongo_fetch import fetch_generated_content
from content_module.services.content_generator import fetch_persona_and_lesson

router = APIRouter(prefix="/api/v1/assistant", tags=["Assistant"])

class ChatRequest(BaseModel):
    message: str
    studyId: str
    chapterIdx: int
    subtopicIdx: int

class ChatResponse(BaseModel):
    reply: str

def sanitize_for_json(obj):
    """
    Ensure the object is JSON-serializable:
    1) Let FastAPI's jsonable_encoder convert datetimes, Pydantic models, ObjectId if possible.
    2) Fallback to json.dumps(..., default=str) -> json.loads(...) to ensure everything is strings/primitives.
    """
    try:
        encoded = jsonable_encoder(obj)
    except Exception:
        encoded = obj

    try:
        # First try a normal dumps (should work if jsonable_encoder cleaned things)
        json.dumps(encoded)
        return encoded
    except TypeError:
        # Last-resort: dump with default=str and load back to python primitives
        try:
            dumped = json.dumps(encoded, default=str)
            return json.loads(dumped)
        except Exception:
            # As a final fallback, return a string summary
            return {"_sanitized_repr": str(encoded)}

@router.post("/chat", response_model=ChatResponse)
async def handle_chat_message(request: ChatRequest):
    """
    Handles a user's chat message, fetches context, and returns an LLM response.
    """
    # Prepare defaults
    persona_data = {}
    subtopic_md_string = ""

    try:
        # 1) Fetch persona (service function) — handle tuple or dict return shapes.
        try:
            persona_result = fetch_persona_and_lesson(request.studyId)
            if isinstance(persona_result, tuple) and len(persona_result) >= 1:
                persona_raw = persona_result[0] or {}
            elif isinstance(persona_result, dict):
                persona_raw = persona_result
            else:
                persona_raw = {}
        except Exception as e:
            print(f"[assistant_routes] Warning: failed to fetch persona for {request.studyId}: {e}")
            traceback.print_exc()
            persona_raw = {}

        # Sanitize persona for JSON (converts datetimes/ObjectId -> strings)
        persona_data = sanitize_for_json(persona_raw)

        # Debug: log the persona keys and types (safe)
        try:
            preview = {k: type(v).__name__ for k, v in (persona_raw.items() if isinstance(persona_raw, dict) else [])}
            print(f"[assistant_routes] Persona preview keys/types: {preview}")
        except Exception:
            pass

        # 2) Fetch subtopic content using service (safer than calling the route handler)
        try:
            doc = fetch_generated_content(request.studyId, request.chapterIdx)
            if not doc:
                print(f"[assistant_routes] No generated content for study={request.studyId} chapter={request.chapterIdx}")
            else:
                generated_list = doc.get("generated_content") or []
                idx = request.subtopicIdx
                if 0 <= idx < len(generated_list):
                    sub = generated_list[idx]
                    # support both pydantic or dict-like objects
                    title = getattr(sub, "title", None) or (sub.get("title") if isinstance(sub, dict) else None) or "Subtopic"
                    body = getattr(sub, "content", None) or (sub.get("content") if isinstance(sub, dict) else None) or (sub.get("text") if isinstance(sub, dict) else "") or ""
                    subtopic_md_string = f"# {title}\n\n{body}"
                else:
                    print(f"[assistant_routes] subtopic index {request.subtopicIdx} out of range (len={len(generated_list)})")
        except Exception as e:
            print(f"[assistant_routes] Warning: error fetching generated content: {e}")
            traceback.print_exc()
            subtopic_md_string = ""

        # Optional: sanitize doc metadata if you ever want to include additional doc fields in reference
        # doc_safe = sanitize_for_json(doc)  # not used for now

        # 3) Call LLM wrapper with persona & content
        # Note: get_assistant_response expects persona dict and a markdown string for content
        llm_reply = await get_assistant_response(
            persona=persona_data or {},
            subtopic_md=subtopic_md_string or "",
            user_message=request.message
        )

        return ChatResponse(reply=llm_reply)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[assistant_routes] Chat endpoint error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

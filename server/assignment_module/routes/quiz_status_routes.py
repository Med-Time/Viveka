from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import Any, Dict

from core.mongo import assignments_col, generation_jobs

from core.mongo import lesson_plan
from lesson_plan_module.core.mongo_fetch import fetch_lesson_plan

router = APIRouter(prefix="/quiz-status", tags=["quiz-status"])


@router.post("/")
async def report_quiz_status(payload: Dict[str, Any]):
    """
    Persist quiz result (idempotent by study/chapter/subtopic).
    If passed == True: mark subtopic complete in lesson_plan and enqueue next subtopic generation.
    Expected payload fields:
      - study_id (str) required
      - chapter_idx (int)
      - subtopic_idx (int)
      - user_id (str, optional)
      - score (number, optional)
      - passed (bool, optional) -- if not provided, server will compute using score & threshold
      - details (any, optional)
    """
    try:
        study_id = payload.get("study_id")
        if not study_id:
            raise HTTPException(status_code=400, detail="study_id required")

        try:
            chapter_idx = int(payload.get("chapter_idx", 0))
        except Exception:
            chapter_idx = 0
        try:
            subtopic_idx = int(payload.get("subtopic_idx", 0))
        except Exception:
            subtopic_idx = 0

        user_id = payload.get("user_id")
        score = payload.get("score")
        passed = payload.get("passed")

        # If passed not provided, infer from score using default threshold
        if passed is None:
            try:
                score_val = float(score) if score is not None else None
            except Exception:
                score_val = None
            PASS_THRESHOLD = 60.0
            passed = (score_val is not None and score_val >= PASS_THRESHOLD)

        job_key = f"quiz_status:{study_id}:{chapter_idx}:{subtopic_idx}"
        now = datetime.now()

        doc = {
            "job_key": job_key,
            "type": "quiz_status",
            "study_id": study_id,
            "chapter_idx": chapter_idx,
            "subtopic_idx": subtopic_idx,
            "user_id": user_id,
            "score": score,
            "passed": bool(passed),
            "details": payload.get("details"),
            "updated_at": now,
        }

        # upsert quiz status (idempotent)
        generation_jobs.update_one(
            {"job_key": job_key, "type": "quiz_status"},
            {"$set": doc, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

        result = {"status": "ok", "saved": True, "passed": bool(passed)}

        if passed:
            # mark lesson plan subtopic complete (best-effort)
            try:
                lesson_plan.update_one(
                    {"study_id": study_id},
                    {
                        "$set": {
                            f"lesson_plan.chapters.{chapter_idx}.sub_topics.{subtopic_idx}.completed": True,
                            f"lesson_plan.chapters.{chapter_idx}.sub_topics.{subtopic_idx}.completed_at": now,
                        }
                    },
                )
            except Exception:
                # swallow marking errors
                pass

            # compute next subtopic using lesson plan if available
            next_ch = chapter_idx
            next_sub = subtopic_idx + 1
            try:
                lp = fetch_lesson_plan(study_id) or {}
                if lp and lp.get("lesson_plan") and isinstance(lp["lesson_plan"].get("chapters"), list):
                    chapters = lp["lesson_plan"]["chapters"]
                    curr_ch = chapters[chapter_idx] if chapter_idx < len(chapters) else None
                    total_sub = len(curr_ch.get("sub_topics", [])) if curr_ch else 0
                    if next_sub >= total_sub:
                        next_ch = chapter_idx + 1
                        next_sub = 0
            except Exception:
                next_ch = chapter_idx
                next_sub = subtopic_idx + 1

            # enqueue content generation for next subtopic idempotently
            try:
                next_job_key = f"content:{study_id}:{next_ch}:{next_sub}"
                existing = generation_jobs.find_one({"job_key": next_job_key, "type": "content"})
                if not existing:
                    generation_jobs.insert_one(
                        {
                            "job_key": next_job_key,
                            "type": "content",
                            "params": {"study_id": study_id, "chapter_idx": next_ch, "subtopic_idx": next_sub},
                            "status": "queued",
                            "progress": 0,
                            "created_at": now,
                            "updated_at": now,
                        }
                    )
                    result["enqueued_next"] = {"chapter": next_ch, "subtopic": next_sub}
                else:
                    result["enqueued_next"] = {"exists": True, "job_key": next_job_key}
            except Exception:
                # ignore enqueue failures
                pass

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{study_id}/{chapter_idx}/{subtopic_idx}")
async def get_quiz_status(study_id: str, chapter_idx: int, subtopic_idx: int):
    try:
        doc = assignments_col.find_one({"study_id": study_id})
        if not doc:
            return {"found": False, "status": None}

        chapters = doc.get("chapters", [])
        if chapter_idx >= len(chapters):
            raise HTTPException(400, "Invalid chapter index")

        subtopics = chapters[chapter_idx].get("subtopic_quizzes", [])
        if subtopic_idx >= len(subtopics):
            raise HTTPException(400, "Invalid subtopic index")

        score = subtopics[subtopic_idx].get("score")

        return {
            "found": True,
            "status": {
                "score": score,
                "passed": True if score and score >= 60 else False,
                "updated_at": doc.get("updated_at"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
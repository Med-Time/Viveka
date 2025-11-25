from datetime import datetime
import threading
import time
import traceback
from pymongo import ReturnDocument

from core.mongo import generation_jobs

# try to import helpers used by worker; fall back to graph-level invocation if helpers missing
try:
    from lesson_plan_module.core.generation import generate_and_save_lesson_plan
except Exception:
    generate_and_save_lesson_plan = None

try:
    from content_module.core.generation import generate_and_save_content
except Exception:
    generate_and_save_content = None

STOP_EVENT = threading.Event()
_worker_thread = None


def _now():
    return datetime.utcnow()


def _claim_next_job():
    """
    Atomically claim the oldest queued job. Returns job doc or None.
    """
    try:
        job = generation_jobs.find_one_and_update(
            {"status": "queued"},
            {"$set": {"status": "processing", "claimed_at": _now(), "updated_at": _now()}},
            sort=[("created_at", 1)],
            return_document=ReturnDocument.AFTER,
        )
        return job
    except Exception:
        return None


def _update_job_progress(job_id, **kwargs):
    kwargs["updated_at"] = _now()
    generation_jobs.update_one({"_id": job_id}, {"$set": kwargs})


def _finish_job_success(job_id, result):
    generation_jobs.update_one(
        {"_id": job_id},
        {"$set": {"status": "ready", "result": result, "progress": 100, "completed_at": _now(), "updated_at": _now()}}
    )


def _finish_job_failed(job_id, error_text):
    generation_jobs.update_one(
        {"_id": job_id},
        {"$set": {"status": "failed", "error": error_text, "progress": 0, "completed_at": _now(), "updated_at": _now()}}
    )


def _process_job(job):
    job_id = job.get("_id")
    job_type = job.get("type")
    params = job.get("params", {}) or {}
    try:
        _update_job_progress(job_id, progress=5)
        if job_type == "lesson_plan":
            study_id = params.get("study_id")
            if generate_and_save_lesson_plan:
                res = generate_and_save_lesson_plan(study_id)
                _finish_job_success(job_id, {"lesson_plan_id": res.get("lesson_plan_id")})
            else:
                # fallback: attempt to import graph directly if available
                raise RuntimeError("Lesson-plan generator helper not available in worker")
        elif job_type == "content":
            study_id = params.get("study_id")
            ch = int(params.get("chapter_idx", 0))
            sub = int(params.get("subtopic_idx", 0))
            if generate_and_save_content:
                res = generate_and_save_content(study_id, ch, sub)
                _finish_job_success(job_id, {"content_id": res.get("content_id")})
            else:
                raise RuntimeError("Content generator helper not available in worker")
        else:
            # unknown job type: mark failed with note
            _finish_job_failed(job_id, f"Unknown job type: {job_type}")
    except Exception as e:
        tb = traceback.format_exc()
        _finish_job_failed(job_id, f"{str(e)}\n{tb}")


def worker_loop(poll_interval=2.0):
    while not STOP_EVENT.is_set():
        job = _claim_next_job()
        if job:
            try:
                _process_job(job)
            except Exception:
                # ensure job marked failed in _process_job; continue
                pass
            continue
        # nothing to do; sleep briefly
        time.sleep(poll_interval)


def start_worker():
    global _worker_thread
    if _worker_thread and _worker_thread.is_alive():
        return
    STOP_EVENT.clear()
    _worker_thread = threading.Thread(target=worker_loop, daemon=True, name="generation-job-worker")
    _worker_thread.start()


def stop_worker():
    STOP_EVENT.set()
    if _worker_thread:
        _worker_thread.join(timeout=5)
# allow running worker directly for debugging
if __name__ == "__main__":
    start_worker()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_worker()

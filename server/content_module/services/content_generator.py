from langchain_google_genai import ChatGoogleGenerativeAI
import dotenv
from core.mongo import persona_col, lesson_plan, content_col
import threading

dotenv.load_dotenv()


# Thread-safe cache for multi-threaded environments
_content_cache = {}
_cache_lock = threading.Lock()


def _cache_key(study_id, chapter_title, subtopic_title):
    return f"{study_id}:{chapter_title}:{subtopic_title}"


def fetch_persona_and_lesson(study_id, user_id=None):
    """Fetch persona report and lesson plan from MongoDB for a given study_id (and optional user_id)."""
    # Fetch persona report
    query = {"study_id": study_id}
    # if user_id:
    #     query["user_id"] = user_id
    persona = persona_col.find_one(query)
    if not persona:
        raise ValueError("Persona report not found for study_id")
    # Fetch lesson plan
    lesson_plans = lesson_plan.find_one(query)
    if not lesson_plans:
        raise ValueError("Lesson plan not found for study_id")

    # Remove MongoDB's _id field if present
    persona.pop("_id", None)
    lesson_plans.pop("_id", None)

    return persona, lesson_plans
    

def get_subtopic(lesson_plan, chapter_idx=0, subtopic_idx=0):
    """Retrieve subtopics for a given chapter index from the lesson plan."""
    chapters = lesson_plan["lesson_plan"]["chapters"]
    subtopic = chapters[chapter_idx]["sub_topics"][subtopic_idx]
    return subtopic


def generate_content(persona, lesson_plan, subtopic, chapter_title, chapter_index, feedback=None):
    """Generate content using Google Gemini model based on persona, lesson plan, and subtopic."""
    agent = ChatGoogleGenerativeAI(model="gemini-2.0-flash-lite", temperature=0.2)

    prompt = f"""
        You are an expert educational content creator. 
        Your task is to generate highly detailed, goal-focused study material for a student based on their persona, lesson plan and level of the learner.

        Goal: {lesson_plan['goal']}
        Level: {lesson_plan['level']}

        --- Persona Information ---
        {persona['learner_profile_summary']}
        Learning Style: {", ".join(persona['learning_style_assessment'])}
        Strengths: {', '.join(persona['strengths'])}
        Weaknesses: {', '.join(persona['weaknesses_and_gaps'])}
        Misconceptions: {', '.join(persona['common_misconceptions'])}
        Engagement and Confidence: {persona['engagement_and_confidence']}

        --- Lesson Plan Context ---
        Subject: {lesson_plan['lesson_plan']['subject_name']}
        Chapter: {chapter_title}
        Chapter Objective: {lesson_plan['lesson_plan']['chapters'][chapter_index]['chapter_outcome']}

        --- Subtopic to Cover ---
        Title: {subtopic['sub_topic_title']}
        Expected Outcome: {subtopic['sub_topic_outcome']}
        Estimated Study Time: {subtopic['estimated_time_minutes']} minutes

        --- Instructions for Content Creation ---
        1. **Content Style**
        - Tailor the explanation to match the learner's persona (learning style, strengths, and weaknesses).
        - Use simple but precise language if the persona prefers clarity, or use analogies/examples if the persona learns better that way.
        - Keep the tone encouraging and engaging.
        - Match the persona information given to make the content relevant and personalized.

        2. **Structure**
        - Start with a **clear introduction** to the subtopic (what it is and why it matters).
        - Provide a **step-by-step explanation** of the concepts.
        - Include **worked-out examples**.
        - Add **important formulas, key terms, or definitions** in a highlighted manner.
        - Provide **common concept clearance questions and answers** (MCQs, short answer, problem-solving).
        - End with a **summary or quick revision notes** for last-minute revision.

        3. **Depth**
        - Ensure the explanation is detailed enough to get concept, not just surface-level.
        - Highlight connections to other related topics if relevant.
        - Include tips or mnemonics for remembering key points.

        4. **Output Format**
        - Use clear sections with markdown headings for example: (### Introduction, ### Explanation, ### Examples, ### Practice Questions, ### Summary).
        - Use bullet points, numbered lists, and tables where appropriate.
        - Keep it easy to read and revision-friendly.

        If Feedback is available you must follow feedback.
        {feedback}

        --- Task ---
        Now, generate the full content for this subtopic based on the above instructions.
        """
    # print(f"Prompt for content generation: {prompt}")
    return agent.invoke(prompt).content

def store_generated_content(study_id, chapter_title, subtopic_title, content):
    """Store generated content in MongoDB and in-memory cache. Upsert if already exists."""
    doc = {
        "study_id": study_id,
        "chapter_title": chapter_title,
        "subtopic_title": subtopic_title,
        "content": content
    }
    content_col.update_one(
        {"study_id": study_id, "chapter_title": chapter_title, "subtopic_title": subtopic_title},
        {"$set": doc},
        upsert=True
    )
    # Store in in-memory cache
    key = _cache_key(study_id, chapter_title, subtopic_title)
    with _cache_lock:
        _content_cache[key] = content
    print(f"Stored content for {subtopic_title} in DB and cache.")


def get_cached_content(study_id, chapter_title, subtopic_title):
    """Retrieve cached content from in-memory cache or MongoDB."""
    key = _cache_key(study_id, chapter_title, subtopic_title)
    with _cache_lock:
        if key in _content_cache:
            return _content_cache[key]
    # If not in cache, fetch from MongoDB and update cache
    doc = content_col.find_one({
        "study_id": study_id,
        "chapter_title": chapter_title,
        "subtopic_title": subtopic_title
    })
    if doc and "content" in doc:
        with _cache_lock:
            _content_cache[key] = doc["content"]
        return doc["content"]
    return None

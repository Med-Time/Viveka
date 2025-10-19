from langchain_google_genai import ChatGoogleGenerativeAI
import dotenv
from content_module.core.mongo import db, sessions_col, persona_col, lesson_plans, content_col
import threading

dotenv.load_dotenv()


# Thread-safe cache for multi-threaded environments
_content_cache = {}
_cache_lock = threading.Lock()


def _cache_key(session_id, chapter_title, subtopic_title):
    return f"{session_id}:{chapter_title}:{subtopic_title}"


def fetch_persona_and_lesson(session_id, user_id=None):
    """Fetch persona report and lesson plan from MongoDB for a given session_id (and optional user_id)."""
    # Fetch persona report
    query = {"session_id": session_id}
    if user_id:
        query["user_id"] = user_id
    persona = persona_col.find_one(query)
    if not persona:
        raise ValueError("Persona report not found for session_id")

    # Fetch lesson plan
    lesson_plan = lesson_plans.find_one(query)
    if not lesson_plan:
        raise ValueError("Lesson plan not found for session_id")

    # Remove MongoDB's _id field if present
    # persona.pop("_id", None)
    # lesson_plan.pop("_id", None)

    return persona, lesson_plan


def get_subtopics(lesson_plan, chapter_idx=0):
    """Retrieve subtopics for a given chapter index from the lesson plan."""
    chapters = lesson_plan["lesson_plan"]["chapters"]
    subtopics = chapters[chapter_idx]["sub_topics"]
    return subtopics


def generate_content(persona, lesson_plan, subtopic, chapter_title):
    """Generate content using Google Gemini model based on persona, lesson plan, and subtopic."""
    agent = ChatGoogleGenerativeAI(model="gemini-2.0-flash-lite", temperature=0.2)
    prompt = f"""
        You are an expert educational content creator. 
        Your task is to generate highly detailed, goal-focused study material for a student based on their persona, lesson plan and level.

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

        --- Subtopic to Cover ---
        Title: {subtopic['sub_topic_title']}
        Expected Outcome: {subtopic['sub_topic_outcome']}
        Estimated Study Time: {subtopic['estimated_time_minutes']['$numberInt']} minutes

        --- Instructions for Content Creation ---
        1. **Content Style**
        - Tailor the explanation to match the learner's persona (learning style, strengths, and weaknesses).
        - Use simple but precise language if the persona prefers clarity, or use analogies/examples if the persona learns better that way.
        - Keep the tone encouraging and engaging.
        - Match the persona information given to make the content relevant and personalized.

        2. **Structure**
        - Start with a **clear introduction** to the subtopic (what it is and why it matters).
        - Provide a **step-by-step explanation** of the concepts.
        - Include **worked-out examples** or scenarios relevant to exams.
        - Add **important formulas, key terms, or definitions** in a highlighted manner.
        - Provide **common concept clearance questions and answers** (MCQs, short answer, problem-solving).
        - End with a **summary or quick revision notes** for last-minute revision.

        3. **Depth**
        - Ensure the explanation is detailed enough to prepare for exams, not just surface-level.
        - Highlight connections to other related topics if relevant.
        - Include tips or mnemonics for remembering key points.

        4. **Output Format**
        - Use clear sections with markdown headings (### Introduction, ### Explanation, ### Examples, ### Exam Practice, ### Summary).
        - Use bullet points, numbered lists, and tables where appropriate.
        - Keep it easy to read and revision-friendly.

        --- Task ---
        Now, generate the full content for this subtopic based on the above instructions.
        """

    return agent.invoke(prompt).content


def store_generated_content(session_id, chapter_title, subtopic_title, content):
    """Store generated content in MongoDB and in-memory cache. Upsert if already exists."""
    doc = {
        "session_id": session_id,
        "chapter_title": chapter_title,
        "subtopic_title": subtopic_title,
        "content": content
    }
    content_col.update_one(
        {"session_id": session_id, "chapter_title": chapter_title, "subtopic_title": subtopic_title},
        {"$set": doc},
        upsert=True
    )
    # Store in in-memory cache
    key = _cache_key(session_id, chapter_title, subtopic_title)
    with _cache_lock:
        _content_cache[key] = content
    print(f"Stored content for {subtopic_title} in DB and cache.")


def get_cached_content(session_id, chapter_title, subtopic_title):
    """Retrieve cached content from in-memory cache or MongoDB."""
    key = _cache_key(session_id, chapter_title, subtopic_title)
    with _cache_lock:
        if key in _content_cache:
            return _content_cache[key]
    # If not in cache, fetch from MongoDB and update cache
    doc = content_col.find_one({
        "session_id": session_id,
        "chapter_title": chapter_title,
        "subtopic_title": subtopic_title
    })
    if doc and "content" in doc:
        with _cache_lock:
            _content_cache[key] = doc["content"]
        return doc["content"]
    return None


def main(session_id, chapter_idx=0):
    persona, lesson_plan = fetch_persona_and_lesson(session_id)
    subtopics = get_subtopics(lesson_plan, chapter_idx)
    chapter_title = lesson_plan["lesson_plan"]["chapters"][chapter_idx]["chapter_title"]

    for subtopic in subtopics:
        subtopic_title = subtopic["sub_topic_title"]
        cached = get_cached_content(session_id, chapter_title, subtopic_title)
        if cached:
            print(f"Using cached content for {subtopic_title}")
            continue
        content = generate_content(persona, lesson_plan, subtopic, chapter_title)
        store_generated_content(session_id, chapter_title, subtopic_title, content)
        print(f"Generated and stored content for {subtopic_title}.md")


# if __name__ == "__main__":
#     user_id = "68cf0316ddf844b68c859b26"  # Example
#     main(user_id, chapter_idx=0)  # 0 for first chapter

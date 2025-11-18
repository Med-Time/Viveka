from langchain_google_genai import ChatGoogleGenerativeAI
import dotenv
from content_module.core.mongo import db, sessions_col, persona_col, lesson_plans, content_col
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
    print(f"Fetching persona for study_id: {study_id}")
    query = {"study_id": study_id}
    # if user_id:
    #     query["user_id"] = user_id
    persona = persona_col.find_one(query)
    print(f"Persona fetched: {persona}")
    if not persona:
        raise ValueError("Persona report not found for study_id")
    print(f"Fetched persona for study_id: {study_id}")
    # Fetch lesson plan
    lesson_plan = lesson_plans.find_one(query)
    if not lesson_plan:
        raise ValueError("Lesson plan not found for study_id")
    
    print(f"Fetched lesson plan for study_id: {study_id}")

    # Remove MongoDB's _id field if present
    persona.pop("_id", None)
    lesson_plan.pop("_id", None)

    return persona, lesson_plan


def get_subtopics(lesson_plan, chapter_idx=0):
    """Retrieve subtopics for a given chapter index from the lesson plan."""
    chapters = lesson_plan["lesson_plan"]["chapters"]
    subtopics = chapters[chapter_idx]["sub_topics"]
    return subtopics


def generate_content(persona, lesson_plan, subtopic, chapter_title, feedback:None):
    """Generate content using Google Gemini model based on persona, lesson plan, and subtopic."""
    agent = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.2)

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
        Chapter Objective: {lesson_plan['lesson_plan']['chapters'][0]['chapter_objective']}

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


# def regenerate_content_node(state):
#     """
#     Regenerate only subtopics that the evaluator marked for revision.
#     Uses REGEN_PROMPT_TEMPLATE to ask the LLM to revise original content based on evaluator feedback.
#     Preserves unchanged subtopics, writes regenerated content via store_generated_content, and updates state.
#     """
#     print(f"[Regenerator] Regenerating content chapter: {getattr(state, 'chapter_idx', 'unknown')}")
#     # Prompt template used when regenerating a subtopic using evaluator feedback.
#     REGEN_PROMPT_TEMPLATE = """
#     You are an expert instructional designer writing learner-facing instructional content for a specific learner persona.
#     Revise the ORIGINAL CONTENT below to address the EVALUATOR FEEDBACK while preserving any correct or useful parts.
#     Do not remove correct content; improve clarity, accuracy, depth, and alignment with the persona.

#     Context:
#     - Learner Persona Summary:
#     {persona_summary}

#     - Lesson / Chapter:
#     {chapter_title}
#     - Subtopic:
#     {subtopic_title}

#     --- ORIGINAL CONTENT ---
#     {original_content}

#     --- EVALUATOR FEEDBACK ---
#     {feedback}

#     Instructions for the revised content:
#     1. Address each point in the feedback specifically and thoroughly.
#     2. Where the feedback asks for more depth or examples, add a minimal, concrete worked example and one brief real-world analogy.
#     3. For clarity issues, simplify sentences and add a one-line "Why this matters" in the Introduction.
#     4. For accuracy issues, correct the factual error and add a one-sentence source note if the content relies on a common fact.
#     5. For alignment issues, include one small activity or tip tailored to the persona's learning style.

#     Produce the revised subtopic content now.
#     """
#     for sub in subtopics:
#         subtopic_title = sub["sub_topic_title"]
#         print(f"[Regenerator] → Checking subtopic: {subtopic_title}")

#         # Determine whether to regenerate: evaluator flagged suggestions OR low score
#         should_regen = False
#         feedback_text = None
#         if getattr(state, "content_evaluations", None):
#             eval_entry = state.content_evaluations.get(subtopic_title) if isinstance(state.content_evaluations, dict) else None
#             if eval_entry:
#                 # treat suggestions or low score as trigger
#                 suggestions = eval_entry.get("suggestions") or eval_entry.get("comments")
#                 score = eval_entry.get("score")
#                 if suggestions:
#                     should_regen = True
#                     feedback_text = suggestions
#                 elif isinstance(score, (int, float)) and score < 7:
#                     should_regen = True
#                     feedback_text = eval_entry.get("comments") or "Evaluator requested improvement."

#         # If no regen required, try cache or reuse previous
#         if not should_regen:
#             cached = get_cached_content(state.study_id, chapter_title, subtopic_title)
#             if cached:
#                 print(f"[Regenerator] Using cached content for {subtopic_title}")
#                 new_generated[subtopic_title] = cached
#                 continue
#             # fallback to previous generated content
#             if prev_generated.get(subtopic_title):
#                 print(f"[Regenerator] Re-using previous content for {subtopic_title}")
#                 new_generated[subtopic_title] = prev_generated[subtopic_title]
#                 continue

#         # Prepare regen prompt
#         original_content = prev_generated.get(subtopic_title, "")
#         feedback_for_prompt = feedback_text or ""
#         regen_prompt = REGEN_PROMPT_TEMPLATE.format(
#             persona_summary=persona_summary + ("\nLearning Style: " + learning_style if learning_style else ""),
#             chapter_title=chapter_title,
#             subtopic_title=subtopic_title,
#             original_content=original_content,
#             feedback=feedback_for_prompt,
#         )

#         print(f"[Regenerator] 🔁 Regenerating {subtopic_title} with feedback.")
#         resp = agent.invoke(regen_prompt)
#         content = getattr(resp, "content", resp)

#         # Persist regenerated content
#         try:
#             store_generated_content(state.study_id, chapter_title, subtopic_title, content)
#         except Exception as e:
#             print(f"[Regenerator] Warning: failed to store regenerated content for {subtopic_title}: {e}")

#         new_generated[subtopic_title] = content

#     # Update state
#     state.generated_content = new_generated
#     state.chapter_title = chapter_title
#     state.retry_count = getattr(state, "retry_count", 0) + 1

#     print(f"[Regenerator] ✅ Regeneration complete for chapter: {chapter_title}")
#     return state

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


def main(study_id, chapter_idx=0):
    persona, lesson_plan = fetch_persona_and_lesson(study_id)
    subtopics = get_subtopics(lesson_plan, chapter_idx)
    chapter_title = lesson_plan["lesson_plan"]["chapters"][chapter_idx]["chapter_title"]

    for subtopic in subtopics:
        subtopic_title = subtopic["sub_topic_title"]
        cached = get_cached_content(study_id, chapter_title, subtopic_title)
        if cached:
            print(f"Using cached content for {subtopic_title}")
            continue
        content = generate_content(persona, lesson_plan, subtopic, chapter_title, feedback=None)
        store_generated_content(study_id, chapter_title, subtopic_title, content)
        print(f"Generated and stored content for {subtopic_title}.md")


# if __name__ == "__main__":
#     user_id = "68cf0316ddf844b68c859b26"  # Example
#     main(user_id, chapter_idx=0)  # 0 for first chapter

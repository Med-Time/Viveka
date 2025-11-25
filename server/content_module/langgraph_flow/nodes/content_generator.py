import time
from content_module.services.content_generator import (
            fetch_persona_and_lesson,
            get_subtopic,
            generate_content,
            get_cached_content,
        )

def generate_content_node(state):
    """
    Generate content for the given chapter/subtopics using persona + lesson plan.
    """
    try:
        persona, lesson_plan = fetch_persona_and_lesson(state.study_id, state.user_id)
        chapter_title = lesson_plan["lesson_plan"]["chapters"][state.chapter_idx]["chapter_title"]
        state.chapter_title = chapter_title
        subtopic = get_subtopic(lesson_plan, state.chapter_idx, state.subtopic_idx)
        
        generated = {}

        subtopic_title = subtopic["sub_topic_title"]
        cached = get_cached_content(state.study_id, state.chapter_title, subtopic_title)
        if cached:
            generated = { "title": subtopic_title, "content": cached, "index": state.subtopic_idx }
            state.generated_content = generated
            return state
        content = generate_content(persona, lesson_plan, subtopic, chapter_title, state.chapter_idx, state.content_evaluations[subtopic_title] if hasattr(state, "content_evaluations") and subtopic_title in state.content_evaluations else None)
        time.sleep(2)  # to avoid rate limits
        generated = { "title": subtopic_title, "content": content, "index": state.subtopic_idx }

        state.generated_content = generated
        state.retry_count += 1
        return state

    except Exception as e:
        state.error = str(e)
        return state

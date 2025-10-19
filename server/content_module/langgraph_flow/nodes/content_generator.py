from content_module.services.content_generator import (
            fetch_persona_and_lesson,
            get_subtopics,
            generate_content,
            store_generated_content,
            get_cached_content,
        )

def generate_content_node(state):
    """
    Generate content for the given chapter/subtopics using persona + lesson plan.
    """

    try:
        persona, lesson_plan = fetch_persona_and_lesson(state.session_id)
        subtopics = get_subtopics(lesson_plan, state.chapter_idx)
        chapter_title = lesson_plan["lesson_plan"]["chapters"][state.chapter_idx]["chapter_title"]
        state.chapter_title = chapter_title

        generated = {}  
        for sub in subtopics:
            subtopic_title = sub["sub_topic_title"]
            cached = get_cached_content(state.session_id, chapter_title, subtopic_title)
            if cached:
                print(f"Using cached content for {subtopic_title}")
                generated[subtopic_title] = cached
                continue
            content = generate_content(persona, lesson_plan, sub, chapter_title)
            # print(f"Generated content for {content}")
            store_generated_content(state.session_id, chapter_title, subtopic_title, content)
            generated[subtopic_title] = content

        state.generated_content = generated
        state.retry_count += 1
        return state

    except Exception as e:
        state.error = str(e)
        return state

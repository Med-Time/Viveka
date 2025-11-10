from content_module.services.content_generator import (
            fetch_persona_and_lesson,
            get_subtopics,
            generate_content,
            get_cached_content,
        )

def generate_content_node(state):
    """
    Generate content for the given chapter/subtopics using persona + lesson plan.
    """
    print(f"Starting content generation for session: {state.study_id}, chapter: {state.chapter_idx} in Content Generator Node")
    try:
        print(f"State received: {state}")
        persona, lesson_plan = fetch_persona_and_lesson(state.study_id, state.user_id)
        print(f"Fetched persona and lesson plan for session: {state.study_id}")
        chapter_title = lesson_plan["lesson_plan"]["chapters"][state.chapter_idx]["chapter_title"]
        state.chapter_title = chapter_title
        print(f"Generating content for chapter: {chapter_title}")
        subtopics = get_subtopics(lesson_plan, state.chapter_idx)
        print(f"Subtopics to generate: {[sub['sub_topic_title'] for sub in subtopics]}")
        
        generated = []

        print(f"Length of subtopics: {len(subtopics)}")

        for i, sub in enumerate(subtopics):
            subtopic_title = sub["sub_topic_title"]
            print(f"Generating content for subtopic: {subtopic_title}")
            cached = get_cached_content(state.study_id, state.chapter_title, state.subtopic_title)
            if cached:
                print(f"Using cached content for {subtopic_title}")
                generated.append({ "title": subtopic_title, "content": cached, "index": i })
                continue
            print(f"No cached content for {subtopic_title}, generating new content.")
            content = generate_content(persona, lesson_plan, sub, chapter_title, state.content_evaluations[subtopic_title] if hasattr(state, "content_evaluations") and subtopic_title in state.content_evaluations else None)
            print(f"Generated content for {subtopic_title}")
            generated.append({ "title": subtopic_title, "content": content, "index": i })

        state.generated_content = generated
        state.retry_count += 1
        return state

    except Exception as e:
        state.error = str(e)
        return state

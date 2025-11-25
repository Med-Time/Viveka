from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import ChatPromptTemplate
from content_module.services.content_generator import fetch_persona_and_lesson
from content_module.schemas import ContentEvaluation, SubtopicEvaluation
from typing import Any, Optional
import time

# Initialize Evaluator LLM
_eval_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.1)
_eval_parser = PydanticOutputParser(pydantic_object=ContentEvaluation)

EVAL_PROMPT = """
    You are an expert instructional designer and evaluator. You will evaluate educational content written for a specific learner persona.

    Context:
    - **Learner Persona Summary:** {persona_summary}
    - **Lesson Chapter:** {chapter_title}
    - **Subtopic Title:** {subtopic_title}
    - **Generated Content:**
    {subtopic_content}

    Evaluate this content based on the following criteria:
    1. **Accuracy & Correctness** - Are the facts and concepts accurate and aligned with the topic?
    2. **Clarity** - Is the explanation clear, concise, and age/level-appropriate?
    3. **Depth & Sufficiency** - Does it provide enough depth to meet the learning objective?
    4. **Alignment with Persona** - Is it personalized to the learner's strengths, weaknesses, and learning style?
    5. **Actionable Suggestions** - Suggest edits or improvements that would make the content more effective.

    Output Requirements:
    - Return structured JSON following this format:
    {format_instructions}
"""

def validate_content_node(state):
    """
    Simplified evaluator: assumes a single-subtopic generated_content object.
    """
    print(f"[Evaluator] Starting content evaluation for session: {getattr(state, 'study_id', 'unknown')}")

    try:
        # Basic sanity checks
        if not hasattr(state, "generated_content") or not state.generated_content:
            state.error = "No generated content found for evaluation."
            print("[Evaluator] ❌ Missing generated content.")
            return state

        # Ensure retry_count exists
        if not hasattr(state, "retry_count") or state.retry_count is None:
            state.retry_count = 0

        # Fetch persona & lesson context
        persona, lesson_plan = fetch_persona_and_lesson(state.study_id, getattr(state, "user_id", None))

        persona_summary = f"""
            Goal: {lesson_plan.get('goal', 'General Learning')}
            Level: {lesson_plan.get('level', 'Beginner')}
            Learner Profile Summary: {persona.get('learner_profile_summary', 'N/A')}
            Learning Style: {", ".join(persona.get('learning_style_assessment', []))}
            Strengths: {", ".join(persona.get('strengths', []))}
            Weaknesses: {", ".join(persona.get('weaknesses_and_gaps', []))}
            Common Misconceptions: {", ".join(persona.get('common_misconceptions', []))}
            Engagement and Confidence: {persona.get('engagement_and_confidence', 'N/A')}
        """

        # Chapter title (infer if missing)
        chapter_title = getattr(state, "chapter_title", None)
        if not chapter_title:
            chapter_idx = getattr(state, "chapter_idx", 0)
            chapter_title = lesson_plan["lesson_plan"]["chapters"][chapter_idx]["chapter_title"]

        # Extract single-subtopic from state.generated_content
        gen = state.generated_content
        # Accept dict shape or object with attributes
        if isinstance(gen, dict):
            subtopic_title = gen.get("title") or gen.get("subtopic_title") or getattr(state, "subtopic_title", None) or "subtopic_0"
            subtopic_content = gen.get("content") or gen.get("text") or gen.get("body") or ""
        else:
            # object-like (Pydantic SubtopicContent)
            subtopic_title = getattr(gen, "title", None) or getattr(state, "subtopic_title", None) or "subtopic_0"
            subtopic_content = getattr(gen, "content", None) or getattr(gen, "text", None) or str(gen)

        print(f"[Evaluator] Evaluating chapter '{chapter_title}', subtopic '{subtopic_title}'")

        # Build prompt and call LLM
        format_instructions = _eval_parser.get_format_instructions()
        prompt_template = ChatPromptTemplate.from_template(EVAL_PROMPT)
        formatted_prompt = prompt_template.format(
            persona_summary=persona_summary,
            chapter_title=chapter_title,
            subtopic_title=subtopic_title,
            subtopic_content=subtopic_content,
            format_instructions=format_instructions,
        )

        response = _eval_llm.invoke(formatted_prompt)
        # small wait to reduce rate-limit risk
        time.sleep(2)

        # Try parsing structured output into single-subtopic ContentEvaluation
        try:
            eval_result: ContentEvaluation = _eval_parser.parse(response.content)
        except Exception as e:
            # Parsing failed — store a minimal fallback evaluation
            print(f"[Evaluator] ⚠️ Parsing failed for '{subtopic_title}': {e}")
            fallback = SubtopicEvaluation(score=1, comments="Parser failed to extract structured data.", suggestions=str(e))
            state.content_evaluation = fallback
            state.content_evaluation_title = subtopic_title
            state.content_grade = "Bad"
            state.content_feedback = "Parser failed to extract structured data."
            state.average_score = 1.0
            state.retry_count = getattr(state, "retry_count", 0) + 1
            return state

        # If parse succeeded, store structured single-subtopic evaluation on state
        if isinstance(eval_result, ContentEvaluation):
            eval_title = eval_result.subtopic_title or subtopic_title
            state.content_evaluation = eval_result.evaluation
            state.content_grade = eval_result.grade
            state.content_feedback = eval_result.feedback
            # average_score is the single score
            try:
                state.average_score = float(eval_result.evaluation.score)
            except Exception:
                state.average_score = None
            state.retry_count = getattr(state, "retry_count", 0) + 1

            print(f"[Evaluator] ✅ Evaluation stored for '{eval_title}': grade={state.content_grade} score={state.average_score}")
            return state

        # Fallback if eval_result not matching expected model
        print("[Evaluator] ⚠️ Unexpected parsed result shape; using fallback evaluation.")
        fallback = SubtopicEvaluation(score=0, comments="Unexpected parser output.", suggestions=str(response.content))
        state.content_evaluation = fallback
        state.content_evaluation_title = subtopic_title
        state.content_grade = "Bad"
        state.content_feedback = "Evaluator produced unexpected format."
        state.average_score = 0.0
        state.retry_count = getattr(state, "retry_count", 0) + 1
        return state

    except Exception as exc:
        state.error = str(exc)
        print(f"[Evaluator] ❌ Exception: {exc}")
        return state

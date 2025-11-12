from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import ChatPromptTemplate
from content_module.services.content_generator import fetch_persona_and_lesson
from content_module.schemas import ContentEvaluation, SubtopicEvaluation
from typing import Dict, Any
import time

# Initialize Evaluator LLM
_eval_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.1)

# ---------------- Prompt Template ----------------
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

# ---------------- Evaluator Function ----------------
def validate_content_node(state):
    """
    LangGraph Node: Evaluate the generated content for each subtopic.
    Produces structured scores, comments, and an overall grade.
    """

    print(f"[Evaluator] Starting content evaluation for session: {getattr(state, 'study_id', 'unknown')}")

    try:
        # ---------------- Basic Validation ----------------
        if not hasattr(state, "generated_content") or not state.generated_content:
            state.error = "No generated content found for evaluation."
            print("[Evaluator] ❌ Missing generated content.")
            return state

        # ---------------- Context Fetch ----------------
        persona, lesson_plan = fetch_persona_and_lesson(state.study_id, getattr(state, "user_id", None))
        # Build full persona context (mirrors generator input)
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


        chapter_title = getattr(state, "chapter_title", None)
        if not chapter_title:
            # Infer from lesson plan
            chapter_idx = getattr(state, "chapter_idx", 0)
            chapter_title = lesson_plan["lesson_plan"]["chapters"][chapter_idx]["chapter_title"]

        print(f"[Evaluator] Evaluating Chapter: {chapter_title}")

        # ---------------- Setup Prompt Template ----------------
        format_instructions = _eval_parser.get_format_instructions()
        prompt_template = ChatPromptTemplate.from_template(EVAL_PROMPT)

        evaluations: Dict[str, Any] = {}
        subtopic_scores = []

        # ---------------- Normalize generated_content ----------------
        # Accept multiple shapes:
        # - list of dicts: [{ "title"|"subtopic_title": ..., "content": ... }, ...]
        # - list of Pydantic/SubtopicContent objects with attributes
        # - dict mapping title -> content
        gen = getattr(state, "generated_content", None)
        normalized: Dict[str, str] = {}

        if isinstance(gen, dict):
            # { title: content | { content: ... } }
            for k, v in gen.items():
                if isinstance(v, str):
                    normalized[k] = v
                elif isinstance(v, dict):
                    normalized[k] = v.get("content") or v.get("text") or ""
                else:
                    normalized[k] = str(v)
        elif isinstance(gen, list):
            for i, item in enumerate(gen):
                if isinstance(item, dict):
                    title = item.get("subtopic_title") or item.get("title") or f"subtopic_{i}"
                    body = item.get("content") or item.get("text") or item.get("body") or ""
                else:
                    # assume object with attributes (Pydantic model or similar)
                    title = getattr(item, "subtopic_title", None) or getattr(item, "title", None) or f"subtopic_{i}"
                    body = getattr(item, "content", None) or getattr(item, "text", None) or ""
                    if body is None:
                        body = str(item)
                # avoid duplicate keys by appending index
                key = title if title not in normalized else f"{title}_{i}"
                normalized[key] = body
        else:
            print("[Evaluator] ⚠️ generated_content has unexpected shape; skipping evaluation.")
            state.error = "generated_content shape unsupported"
            return state

        # ---------------- Iterate Over Normalized Content ----------------
        for subtopic_title, subtopic_content in normalized.items():
            print(f"[Evaluator] → Evaluating subtopic: {subtopic_title}")

            formatted_prompt = prompt_template.format(
                persona_summary=persona_summary,
                chapter_title=chapter_title,
                subtopic_title=subtopic_title,
                subtopic_content=subtopic_content,
                format_instructions=format_instructions,
            )

            # Invoke LLM
            response = _eval_llm.invoke(formatted_prompt)
            time.sleep(2)  # to avoid rate limits

            # Try parsing structured output
            try:
                eval_result: ContentEvaluation = _eval_parser.parse(response.content)
            except Exception as e:
                print(f"[Evaluator] ⚠️ Parsing failed for '{subtopic_title}': {e}")
                eval_result = ContentEvaluation(
                    grade="Bad",
                    feedback="Parser failed to extract structured data.",
                    metrics={
                        subtopic_title: SubtopicEvaluation(
                            score=1,
                            comments="Failed to parse structured evaluation.",
                            suggestions=str(e),
                        )
                    },
                )

            # Extract relevant subtopic metrics
            if isinstance(eval_result, ContentEvaluation):
                metric = None
                if subtopic_title in eval_result.metrics:
                    metric = eval_result.metrics[subtopic_title]
                elif eval_result.metrics:
                    # fallback: first metric in dict
                    metric = next(iter(eval_result.metrics.values()))

                if metric:
                    evaluations[subtopic_title] = {
                        "score": metric.score,
                        "comments": metric.comments,
                        "suggestions": metric.suggestions,
                    }
                    subtopic_scores.append(metric.score)
                else:
                    evaluations[subtopic_title] = {
                        "score": 1,
                        "comments": "No metrics found in output.",
                        "suggestions": eval_result.feedback,
                    }
                    subtopic_scores.append(1)
            else:
                # Raw fallback
                evaluations[subtopic_title] = {
                    "score": 1,
                    "comments": "Unexpected format from LLM.",
                    "suggestions": str(response.content),
                }
                subtopic_scores.append(1)

        # ---------------- Aggregate Results ----------------
        avg_score = sum(subtopic_scores) / max(len(subtopic_scores), 1)
        overall_grade = "Good" if avg_score >= 7 else "Bad"
        overall_feedback = (
            "Content meets learning and clarity standards."
            if overall_grade == "Good"
            else "Content needs improvements as per the evaluator suggestions."
        )

        # ---------------- Update State ----------------
        state.content_evaluations = evaluations
        state.content_grade = overall_grade
        state.content_feedback = overall_feedback
        state.average_score = avg_score
        state.retry_count = getattr(state, "retry_count", 0) + 1

        print(f"[Evaluator] ✅ Evaluation complete. Grade: {overall_grade}, Avg Score: {avg_score:.2f}")
        return state

    except Exception as e:
        state.error = str(e)
        print(f"[Evaluator] ❌ Exception: {e}")
        return state

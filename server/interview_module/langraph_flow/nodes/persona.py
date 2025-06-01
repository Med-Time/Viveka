
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
from interview_module.core.mongo import persona_col
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from interview_module.services.mongo_persistence import save_persona
# Ensure you have feedback_history in your state class
class QAEntry(BaseModel):
    question: str
    answer: str
    score: int
    feedback: str # Now including feedback

class PersonaSummary(BaseModel):
    learner_profile_summary: str = Field(..., description="A concise, high-level summary of the learner's overall profile, personality, and approach to learning based on the interview.")
    learning_style_assessment: List[str] = Field(..., description="Identify key aspects of the learner's preferred or observed learning style (e.g., conceptual, practical, visual, auditory, kinesthetic, prefers examples, thrives on theory, self-directed, needs structure). Just list traits.")
    strengths: List[str] = Field(..., description="List specific concepts or areas where the learner demonstrated strong understanding during the interview.")
    weaknesses_and_gaps: List[str] = Field(..., description="List specific concepts, sub-concepts, or skills where the learner showed weakness, misunderstanding, or knowledge gaps, derived from low scores and feedback.")
    common_misconceptions: List[str] = Field(..., description="List any recurring or significant misconceptions identified from their answers or feedback.")
    engagement_and_confidence: str = Field(..., description="Describe the learner's observable engagement level and confidence throughout the interview based on their responses and tone (if discernible).")
    actionable_learning_recommendations: List[str] = Field(..., description="Specific, actionable recommendations for how the learner should approach future study, what types of resources would be most effective (e.g., more practice problems, re-reading theoretical explanations, watching videos, hands-on labs), and strategies to overcome identified weaknesses. These should be directly useful for a lesson plan.")
    preliminary_personalized_roadmap_suggestions: List[str] = Field(..., description="A suggested sequence of 3-5 high-level topics or chapters (more granular than the initial curriculum concepts) that should be prioritized in their personalized lesson plan to address weaknesses and build on strengths, leading towards their overall goal. These should be highly specific, e.g., 'Mastering Python Dictionaries: Advanced Methods'.")

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
structured_llm = llm.with_structured_output(PersonaSummary)

def run_persona(state):
    # Ensure feedback_history is correctly populated from score.py
    if not hasattr(state, 'feedback_history') or not state.feedback_history:
        print("WARNING: feedback_history is empty or missing. Persona generation might be less detailed.")
        # You might want to generate a simpler persona or raise an error
        # For robustness, we'll ensure qa_pairs handles this gracefully.
        qa_pairs = zip(state.question_history, state.answer_history, state.score_history)
        input_text = "\n".join([
            f"Q: {q}\nA: {a}\nScore: {s}" for q, a, s in qa_pairs
        ])
    else:
        qa_entries = [
            QAEntry(question=q, answer=a, score=s, feedback=f)
            for q, a, s, f in zip(state.question_history, state.answer_history, state.score_history, state.feedback_history)
        ]
        input_text = "\n\n".join([
            f"--- Interview Segment ---\nQ: {entry.question}\nA: {entry.answer}\nScore: {entry.score}\nFeedback: {entry.feedback}"
            for entry in qa_entries
        ])

    subject = state.subject
    goal = state.goal
    level = state.level
    initial_curriculum_concepts = ", ".join(state.curriculum) if state.curriculum else "N/A"

    prompt = f"""
    You are an expert educational psychologist and personalized learning architect.
    Your objective is to analyze a student's performance during an interview to create a highly detailed, actionable learning persona and a preliminary personalized roadmap. This persona is crucial for generating a custom lesson plan that will truly cater to the learner's unique needs and help them achieve their stated goal.

    **Student's Initial Context:**
    - Subject: {subject}
    - Learning Goal: "{goal}"
    - Stated Proficiency Level: {level}
    - Initial Interview Concepts: {initial_curriculum_concepts}

    **Interview Q&A History with Scores and Feedback:**
    {input_text}

    **Your Task: Generate a Comprehensive Learning Persona by analyzing the above interview data.**

    **Strict Requirements & Guidelines:**
    1.  **Learner Profile Summary:** Provide a concise, insightful overview of the learner's general approach, personality, and underlying learning patterns observed.
    2.  **Learning Style Assessment:** Based on how they answered questions and struggled/succeeded, deduce their likely learning style(s) and preferences. (e.g., Do they prefer theoretical explanations or practical application? Do they benefit from step-by-step guidance or self-discovery? Are they visual learners who missed details, or conceptual learners who struggled with specifics?)
    3.  **Strengths:** Identify specific concepts or areas where the learner demonstrated clear proficiency and understanding. Be precise (e.g., "Strong grasp of Python list manipulation," "Clear understanding of conditional logic").
    4.  **Weaknesses and Gaps:** Pinpoint precise concepts, sub-concepts, or prerequisite knowledge where the learner struggled, made errors, or showed significant gaps. Refer directly to the questions and feedback.
    5.  **Common Misconceptions:** List any specific, recurring incorrect ideas or misunderstandings they exhibited.
    6.  **Engagement and Confidence:** Comment on their apparent engagement, persistence, and confidence levels throughout the interview process.
    7.  **Actionable Learning Recommendations:** Provide concrete, practical recommendations for *how* this specific learner should study. This should be a bulleted list of strategies (e.g., "Focus on hands-on coding exercises for X," "Review foundational theory for Y," "Utilize visual aids for Z," "Practice problem-solving techniques," "Break down complex problems into smaller steps"). These recommendations should directly address their identified weaknesses and leverage their strengths.
    8.  **Preliminary Personalized Roadmap Suggestions:** Suggest a sequential list of 3-5 *specific* topics or mini-modules that should be prioritized in their personalized lesson plan. These should be more granular than the initial curriculum concepts if possible, acting as specific "chapters" to be covered. They should directly address identified weaknesses and reinforce strengths, moving the learner towards their overall goal.
        * **Example:** Instead of just "Lists", suggest "Deep Dive into Python Lists: Methods, Mutability, and Common Operations" or "Understanding Scope and Closures in Python Functions".

    **Consider Edge Cases:**
    * **Limited Interview Data:** If the interview was very short or inconclusive, generate the most informed persona possible with the available data, acknowledging limitations. Focus on high-level observations.
    * **Mixed Performance:** If performance was inconsistent, analyze the patterns. Did they struggle with specific question types, or specific concepts?
    * **Ambiguous Answers:** If feedback indicates ambiguity, infer the most likely issues and recommend clarifying activities.

    """
    persona = structured_llm.invoke(prompt)
    state.persona_summary = persona # Ensure you're storing the full PersonaSummary object
    print(f"Persona Summary: {persona.learner_profile_summary}")
    print(f"Preliminary Roadmap: {persona.preliminary_personalized_roadmap_suggestions}")
    save_persona(state.session_id, state.persona_summary) 
    # You might want to save persona to MongoDB here as well, if it's not handled by SaveAll node
    # persona_col.insert_one(persona.model_dump()) # Example if direct save needed
    return state
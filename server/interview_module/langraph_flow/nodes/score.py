from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
from pydantic import BaseModel, Field
from typing import List

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")

class ScoreEvaluation(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Score between 0 and 100 for the user's last answer, reflecting accuracy and completeness.")
    feedback: str = Field()

structured_llm = llm.with_structured_output(ScoreEvaluation)

def score_answer(state):
    answer = state.answer
    question = state.current_question
    subject = state.subject
    level = state.level
    goal = state.goal
    current_concept = state.curriculum[state.current_concept_index] if state.curriculum and state.current_concept_index < len(state.curriculum) else "N/A"
    question_type = state.current_question_type

    # Initialize instructions based on question type
    # These will explicitly guide the LLM's scoring and feedback generation
    scoring_instruction_for_llm = ""
    feedback_instruction_for_llm = ""
    general_rubric_applicability_note = "" # New note to clarify rubric usage

    if question_type == "mcq":
        scoring_instruction_for_llm = (
            "**Primary Scoring Rule:** Evaluate solely on the correctness of the chosen option. "
            "If the student's answer (e.g., 'A', 'B', 'C', 'D' or the exact text of the correct option if the question provided it) is precisely correct, assign a score of **100**. "
            "If the answer is incorrect or ambiguous, assign a score of **0**. "
            "**Crucially, do NOT penalize for lack of explanation or depth for correct MCQ answers.** The student is only expected to select the correct option."
        )
        feedback_instruction_for_llm = (
            "* **Strengths:** If correct, clearly state the answer was correct and why (briefly, based on the correct option). "
            "* **Weaknesses/Gaps:** If incorrect, clearly state why the chosen option was wrong and identify the correct answer/option. "
            "* **Misconceptions:** If an incorrect choice reveals a common misconception, briefly highlight it. "
            "* **Actionable Advice:** If correct, encourage. If incorrect, briefly guide towards the correct understanding related to the correct option, without giving a full, detailed explanation (as this was an MCQ)."
        )
        general_rubric_applicability_note = "The general rubric's emphasis on 'completeness and depth' does NOT apply for this MCQ. Focus strictly on correctness."

    elif question_type == "one_word_answer":
        scoring_instruction_for_llm = (
            "**Primary Scoring Rule:** Evaluate based on the exact correctness of the one word. "
            "If the word is precisely correct, assign a score of **100**. If incorrect or deviates significantly, assign a score of **0-10**. "
            "**Do NOT expect or penalize for explanations or additional context.**"
        )
        feedback_instruction_for_llm = (
            "* **Strengths:** If correct, clearly state the answer was correct. "
            "* **Weaknesses/Gaps:** If incorrect, state the correct word and briefly explain why the provided word was wrong. "
            "* **Misconceptions:** If applicable, identify any clear misconceptions. "
            "* **Actionable Advice:** If correct, encourage. If incorrect, briefly guide towards the correct word/concept."
        )
        general_rubric_applicability_note = "The general rubric's emphasis on 'completeness and depth' does NOT apply for this one-word answer. Focus strictly on correctness."

    elif question_type == "fill_in_the_blanks":
        scoring_instruction_for_llm = (
            "**Primary Scoring Rule:** Evaluate the correctness of the filled-in text(s). "
            "If there are multiple blanks, score proportionally (e.g., 50 for one correct out of two). "
            "Assign a score of **100** for fully correct answers, **30-70** for partially correct, and **0-20** for largely incorrect. "
            "**Do NOT expect or penalize for explanations beyond the filled-in content.**"
        )
        feedback_instruction_for_llm = (
            "* **Strengths:** Clearly state what parts of the blanks were filled correctly. "
            "* **Weaknesses/Gaps:** Pinpoint specific blanks that were incorrect or incomplete, and state the correct fill-ins. "
            "* **Misconceptions:** If applicable, identify any clear misconceptions based on the incorrect fills. "
            "* **Actionable Advice:** Guide the student towards the correct content for the incorrect blanks."
        )
        general_rubric_applicability_note = "The general rubric's emphasis on 'completeness and depth' is applied only to the accuracy of the filled-in content, not additional explanation."

    elif question_type == "detailed_answer":
        scoring_instruction_for_llm = (
            "**Primary Scoring Rule:** Apply the provided general scoring rubric thoroughly. "
            "Evaluate the accuracy, completeness, depth, and clarity of the explanation provided. "
            "A comprehensive response is expected, demonstrating strong understanding of the concept."
        )
        feedback_instruction_for_llm = (
            "* **Strengths:** Clearly identify what the student did well (e.g., accurate points, good structure, correct examples, clear explanations). "
            "* **Weaknesses/Gaps:** Pinpoint specific areas where the answer was weak, incomplete, incorrect, or lacked sufficient detail/depth, referencing the concept. "
            "* **Misconceptions:** Highlight any clear misconceptions. "
            "* **Explain Why:** Explain *why* certain parts of the answer were correct or incorrect, referencing the concept. "
            "* **Actionable Advice:** Suggest *what* the student needs to improve or focus on to better understand the concept (e.g., 'elaborate on X', 'clarify the distinction between Y and Z', 'provide an example of Z')."
        )
        general_rubric_applicability_note = "The general scoring rubric below applies in full, as a detailed explanation is expected."

    else: # Fallback for unknown or new types - lean towards expecting detail for safety but remain flexible
        scoring_instruction_for_llm = (
            "Evaluate the answer based on its direct relevance, correctness, and the expected level of detail for a typical interview response to this kind of question. "
            "If the question implies a detailed response, expect completeness. If it implies brevity, score on accuracy and conciseness."
        )
        feedback_instruction_for_llm = (
            "* **Strengths:** Clearly identify what the student did well. "
            "* **Weaknesses/Gaps:** Pinpoint specific areas where the answer was weak, incomplete, or incorrect. "
            "* **Misconceptions:** Highlight any clear misconceptions. "
            "* **Actionable Advice:** Suggest *what* the student needs to improve or focus on."
        )
        general_rubric_applicability_note = "Apply the general rubric with flexibility, considering what constitutes a 'complete' answer for this unclassified question type."


    prompt = f"""
    You are an expert educational evaluator for a personalized learning AI.
    Your task is to thoroughly score a student's answer to an interview question and provide detailed, actionable feedback.

    **Context for Evaluation:**
    - Subject: {subject}
    - Learning Goal: {goal}
    - Learner Level: {level}
    - Current Concept being assessed: {current_concept}

    **Question to evaluate:**
    Q: {question}

    **Student's Answer:**
    A: {answer}

    ---
    **Question Type Specific Instructions:**
    Question Type: {question_type.upper()}
    {scoring_instruction_for_llm}
    ---

    **General Scoring Rubric (Read carefully how it applies based on Question Type Specific Instructions):**
    {general_rubric_applicability_note}
    * **0-39: Emerging Understanding.** The answer shows very limited grasp of the core concept. There are significant inaccuracies, major gaps, or fundamental misconceptions. This indicates a strong need for review of foundational material.
    * **40-69: Developing Understanding.** The answer demonstrates some understanding, with a few correct points or a partial grasp of the concept. However, there are notable errors, omissions, or areas of confusion. This score indicates the student is on the right track but needs further practice or clarification on specific aspects to solidify their knowledge.
    * **70-89: Solid Understanding.** The answer is mostly accurate and complete, showing a good command of the core concept. There might be minor inaccuracies, slight omissions, or areas where the explanation could be more precise or comprehensive. This is generally sufficient for moving on to the next concept.
    * **90-100: Exemplary Understanding.** The answer is highly accurate, complete, and demonstrates a deep, nuanced mastery of the concept. The explanation is clear, precise, and may include advanced insights or excellent practical application. This indicates exceptional understanding.

    ---
    **Instructions for Detailed Feedback:**
    Provide specific, constructive and encouraging feedback based on the scoring.
    {feedback_instruction_for_llm}
    Maintain a supportive and growth-oriented tone throughout the feedback.
    Make sure you handel the student's grammatical and spelling mistakes in a way that you value his/her knowledge on the partcular subject : {subject} and not the language.
    Return the score and feedback in the exact Pydantic `ScoreEvaluation` JSON format. Do not include any additional conversational text, preambles, or explanations outside the JSON.
    """
    
    result = structured_llm.invoke(prompt)
    score = result.score
    feedback = result.feedback

    print(f"Score: {score}")
    print(f"Feedback: {feedback}")

    # Update state - ensure feedback is stored alongside Q, A, Score
    state.score_history.append(score)
    state.answer_history.append(answer)
    state.question_history.append(question)
    state.feedback_history.append(feedback) # Store feedback

    return state
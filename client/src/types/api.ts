export interface StartInterviewRequest {
    user_id: string;
    subject: string;
    goal: string;
    level: string;
  }
  
  export interface StartInterviewResponse {
    status: string;
    question: string;
    concept: string;
    session_id: string;
  }
  
  export interface AnswerInterviewRequest {
    user_id: string;
    answer: string;
  }
  
  export interface AnswerInterviewIntermediateResponse {
    status: "ok";
    question: string;
    concept: string;
    score: number;
  }
  
  export interface AnswerInterviewFinalResponse {
    status: "done";
    final_score: number;
    summary: {
      learner_profile_summary: string;
      learning_style_assessment: string[];
      strengths: string[];
      weaknesses_and_gaps: string[];
      common_misconceptions: string[];
      engagement_and_confidence: string;
      actionable_learning_recommendations: string[];
      preliminary_personalized_roadmap_suggestions: string[];
    };
    feedback: string[];
  }
  
  export interface LessonPlanResponse {
    session_id: string;
    user_id: string;
    subject: string;
    goal: string;
    level: string;
    lesson_plan: {
      subject_name: string;
      learner_level: string;
      learner_goal: string;
      overall_course_outcome: string;
      chapters: {
        chapter_title: string;
        chapter_outcome: string;
        sub_topics: {
          sub_topic_title: string;
          sub_topic_outcome: string;
          estimated_time_minutes: number;
        }[];
        chapter_total_time_minutes: number;
      }[];
      total_module_time_hours: number;
      prerequisites: string[];
      adaptive_notes: string | null;
    };
    grade: string;
    feedback: string;
    persona_report: {
      learner_profile_summary: string;
      learning_style_assessment: string[];
      strengths: string[];
      weaknesses_and_gaps: string[];
      common_misconceptions: string[];
      engagement_and_confidence: string;
      actionable_learning_recommendations: string[];
      preliminary_personalized_roadmap_suggestions: string[];
    };
    qa_feedback_history: {
      concept: string;
      question: string;
      answer: string;
      score: number;
    }[];
    curriculum_generated: string[];
  }
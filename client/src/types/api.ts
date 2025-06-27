
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
  
  // ...and so on for lesson plan
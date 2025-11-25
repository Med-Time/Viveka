export type QuestionType = "mcq" | "detailed_answer" | "fill_in_the_blanks" | "one_word_answer";

export interface StartInterviewRequest {
  user_id: string;
  subject: string;
  goal: string;
  level: string;
  prior_knowledge?: string;
  hours_per_week?: number;
}

export interface StartInterviewResponse {
  status: "ok" | "error" | "done";
  message?: string;
  study_id: string;
  type?: QuestionType;
  question?: string;
  options?: string[];
  concept?: string;
}

export interface AnswerInterviewRequest {
  user_id: string;
  answer: string;
}

export interface AnswerInterviewResponse {
  status: "ok" | "error" | "done";
  study_id?: string;
  score?: number;
  type?: QuestionType;
  question?: string;
  concept?: string;
  message?: string;
  feedback?: string;
  final_score?: number;
  summary?: string;
}

export interface PersonaReport {
  _id: string;
  study_id: string;
  type: string;
  created_at: string | Date;
  learner_profile_summary: string;
  learning_style_assessment: string[];
  strengths: string[];
  weaknesses_and_gaps: string[];
  common_misconceptions: string[];
  engagement_and_confidence: string;
  actionable_learning_recommendations: string[];
  preliminary_personalized_roadmap_suggestions: string[];
}

export interface PersonaGetResponse {
  status: "success" | "error";
  data: PersonaReport;
}

export interface LessonPlanItem {
  subject_name?: string;
  learner_level?: string;
  learner_goal?: string;
  overall_course_outcome?: string;
  chapters: Chapter[];
  total_module_time_hours?: number;
  prerequisites?: string[];
  adaptive_notes?: string;
}
export interface LessonPlan {
  user_id: string;
  lesson_plan: LessonPlanItem;
  grade: string;
  feedback: string;
  persona_report_id: string;
};

export interface ChapterContent {
  study_id: string;
  chapter_idx: number;
  subtopic_title: string;
  generated_content: Record<string, string>;
}

export interface SubTopic {
  sub_topic_title: string;
  sub_topic_outcome?: string;
  estimated_time_minutes?: number;
  completed?: boolean;
  completed_at?: string | Date;
};

export interface Chapter {
  chapter_title: string;
  chapter_outcome?: string;
  sub_topics: SubTopic[];
  chapter_total_time_minutes?: number;
};



export interface AuthResponse {
  token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name?: string;
    studies?: string[];
  };
}

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
  age?: number;
  interests?: string[];
  goals?: string;
  learning_pace?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}




// Matches 'QuestionOption' in backend
export interface QuestionOption {
  id: string;
  text: string;
}

// Matches 'Question' in backend
export interface Question {
  question_id: string; // Backend gives this UUID
  question_type: "mcq" | "fill_in_blank" | "open_ended";
  question_text: string;
  options?: QuestionOption[]; // Only present for MCQs
  correct_answer: string;
  explanation: string;
  rubric?: string;
}

// Matches the response from /subtopic/..., /chapter/..., /subject/...
export interface AssignmentResponse {
  questions: Question[];
}

// Matches 'QuestionFeedback' in backend
export interface QuestionFeedback {
  question_id: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  feedback: string;
  explanation: string;
}

// Matches 'SubmitAssignmentResponse' in backend
export interface SubmitResponse {
  overall_score: number;
  feedback_list: QuestionFeedback[];
}
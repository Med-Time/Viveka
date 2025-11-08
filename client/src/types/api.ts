export type QuestionType = "mcq" | "open" | "fill";

export interface StartInterviewRequest {
  user_id: string;
  subject: string;
  goal: string;
  level: string;
  prior_knowledge?: string;
  hours_per_week?: number;
}

export interface StartInterviewResponse {
  session_id: string;
  question: {
    id: string;
    type: QuestionType;
    prompt: string;
    options?: string[];        // for mcq
    blanks?: number;           // for fill
  } | null;
}

export interface AnswerInterviewRequest {
  session_id: string;
  question_id: string;
  answer: string | string[];  // text, mcq option key(s), or blanks joined
}

export interface AnswerInterviewResponse {
  evaluation?: {
    correctness?: "correct" | "partial" | "incorrect";
    score?: number;            // 0-1
    feedback?: string;
  };
  next_question?: StartInterviewResponse["question"] | null;
  completed: boolean;
}

export interface PersonaReport {
  session_id: string;
  summary: string;
  traits: Array<{ key: string; value: string }>;
  recommended_level?: string;
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
  session_id: string;
  chapter_idx: number;
  chapter_title: string;
  generated_content: Record<string, string>;
}

export interface SubTopic {
  sub_topic_title: string;
  sub_topic_outcome?: string;
  estimated_time_minutes?: number;
};

export interface Chapter {
  chapter_title: string;
  chapter_outcome?: string;
  sub_topics: SubTopic[];
  chapter_total_time_minutes?: number;
};



export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
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

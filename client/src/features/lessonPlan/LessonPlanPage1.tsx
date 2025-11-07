import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { lessonPlanApi } from "./lessonPlan.api";

type SubTopic = {
  sub_topic_title: string;
  sub_topic_outcome?: string;
  estimated_time_minutes?: number;
};

type Chapter = {
  chapter_title: string;
  chapter_outcome?: string;
  sub_topics: SubTopic[];
  chapter_total_time_minutes?: number;
};

type LessonPlan = {
  subject_name?: string;
  learner_level?: string;
  learner_goal?: string;
  overall_course_outcome?: string;
  chapters: Chapter[];
  total_module_time_hours?: number;
  prerequisites?: string[];
  adaptive_notes?: string;
};

type LessonPlanDetails = {
    user_id: string;
    lesson_plan: LessonPlan;
    grade: string;
    feedback: string;
    persona_report_id: string;
}

export const LessonPlanPage: React.FC = () => {
//   const { sessionId } = useParams<{ sessionId: string }>();
  const sessionId = "68cd06a9d04e51025dac3c7e";
  const [LessonPlanDetails, setLessonPlanDetails] = useState<LessonPlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session id");
      setLoading(false);
      return;
    }
    setLoading(true);
    lessonPlanApi
      .get(sessionId)
      .then((data) => {
        setLessonPlanDetails(data);
      })
      .catch((e) => {
        console.error(e);
        setError("Failed to load lesson plan");
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div>Loading lesson plan…</div>;
  if (error) return <div>{error}</div>;
  if (!LessonPlanDetails) return <div>No lesson plan found.</div>;

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">{LessonPlanDetails.lesson_plan.subject_name || "Lesson Plan"}</h1>
      <p className="mb-6">{LessonPlanDetails.lesson_plan.overall_course_outcome}</p>

      {LessonPlanDetails.lesson_plan.chapters.map((ch, idx) => (
        <div key={idx} className="mb-6 p-4 border rounded-md">
          <h2 className="text-xl font-semibold">{ch.chapter_title}</h2>
          {ch.chapter_outcome && <p className="text-sm text-muted mb-2">{ch.chapter_outcome}</p>}

          <ul className="mt-2 space-y-2">
            {ch.sub_topics.map((st, sidx) => (
              <li key={sidx} className="p-2 bg-gray-50 rounded">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{st.sub_topic_title}</div>
                    {st.sub_topic_outcome && <div className="text-sm text-muted">{st.sub_topic_outcome}</div>}
                  </div>
                  {st.estimated_time_minutes && (
                    <div className="text-sm text-muted">{st.estimated_time_minutes} min</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
import React, { useEffect, useState } from 'react';
import { LessonPlanResponse } from './types/api';
import { fetchLessonPlan } from './api/lessonPlan';

const ChevronDown = () => (
  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUp = () => (
  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const LessonPlan: React.FC = () => {
  const [lessonPlan, setLessonPlan] = useState<LessonPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchLessonPlan('abc123')
      .then((data) => {
        setLessonPlan(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch lesson plan.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-blue-700 text-lg">Loading lesson plan...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 mt-8">
        {error}
      </div>
    );
  }

  if (!lessonPlan) return null;

  const { lesson_plan } = lessonPlan;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-1">Lesson Plan</h1>
      <p className="text-sm text-blue-500 mb-6 cursor-pointer hover:underline">
        {lesson_plan.overall_course_outcome}
      </p>
      <div className="bg-red-500 text-white p-4">If this is red, Tailwind works!</div>

      <div className="space-y-4">
        {lesson_plan.chapters.map((chapter, i) => (
          <div key={i}>
            <button
              className="flex w-full items-center justify-between py-4 focus:outline-none"
              onClick={() => setExpanded(expanded === i ? null : i)}
              aria-expanded={expanded === i ? 'true' : 'false'}
            >
              <div className="flex flex-col items-start text-left">
                <span className="text-base font-semibold text-black">{chapter.chapter_title}</span>
                <span className="text-sm text-gray-400">{chapter.chapter_total_time_minutes} min</span>
              </div>
              <span>{expanded === i ? <ChevronUp /> : <ChevronDown />}</span>
            </button>

            {expanded === i && (
              <div className="ml-1 px-6 pb-6 pt-1 bg-white text-sm text-gray-800 animate-fade-in">
                <div className="mb-2">
                  <span className="block font-medium text-gray-700">Learning Outcome:</span>
                  <span className="italic">{chapter.chapter_outcome}</span>
                </div>
                {chapter.sub_topics?.length > 0 && (
                  <div>
                    <span className="block font-medium text-gray-700">Subtopics:</span>
                    <ul className="list-disc ml-5">
                      {chapter.sub_topics.map((sub, j) => (
                        <li key={j} className="mb-1">
                          <span className="font-semibold">{sub.sub_topic_title}:</span> {sub.sub_topic_outcome}{' '}
                          <span className="text-xs text-gray-500">({sub.estimated_time_minutes} min)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LessonPlan;

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { assignmentApi } from "./assignment.api";
import { Question, QuestionFeedback } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SpeechTextarea } from "@/components/Question/SpeechTextarea";
import { toast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

// NEW imports
import { contentApi } from "@/features/content/content.api";
import { progressApi } from "@/features/content/progress.api";
import { lessonPlanApi } from "@/features/lessonPlan/lessonPlan.api";
import { safeGetJson } from "@/utils/storage";

export default function AssignmentPage() {
  const { studyId, level, chapterIdx, subtopicIdx } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [markingProgress, setMarkingProgress] = useState(false);

  // result now includes whether passed and nextRoute for navigation
  const [result, setResult] = useState<
    | {
        score: number;
        feedback: QuestionFeedback[];
        passed: boolean;
        nextRoute?: string | null;
      }
    | null
  >(null);

  // NEW helper: enqueue next subtopic generation (idempotent, fire-and-forget)
  const enqueueNextSubtopic = async (studyId: string, cIdx: number, sIdx?: number) => {
    try {
      const lp = await lessonPlanApi.get(studyId).catch(() => null);
      let nextChapter = cIdx;
      let nextSubtopic = (sIdx ?? -1) + 1;

      if (lp && lp.lesson_plan && Array.isArray(lp.lesson_plan.chapters)) {
        const chapters = lp.lesson_plan.chapters;
        const chapter = chapters[cIdx];
        const totalSub = chapter && Array.isArray(chapter.sub_topics) ? chapter.sub_topics.length : 0;
        if (nextSubtopic >= totalSub) {
          nextChapter = cIdx + 1;
          nextSubtopic = 0;
        }
      } else {
        if (typeof sIdx === "number") nextSubtopic = sIdx + 1;
        else nextSubtopic = 0;
      }

      void contentApi.enqueue(studyId, nextChapter, nextSubtopic).catch(() => null);
    } catch (e) {
      // ignore
    }
  };

  // 1. Fetch Questions on Load
  useEffect(() => {
    if (!studyId || !level || !chapterIdx) return;

    const fetchQuiz = async () => {
      try {
        setLoading(true);
        let data;

        if (level === "subtopic" && subtopicIdx) {
          data = await assignmentApi.getSubtopicQuiz(studyId, parseInt(chapterIdx), parseInt(subtopicIdx));
        } else if (level === "chapter") {
          data = await assignmentApi.getChapterTest(studyId, parseInt(chapterIdx));
        } else if (level === "subject") {
          data = await assignmentApi.getSubjectCapstone(studyId);
        }

        if (data) {
          setQuestions(data.questions);
          const existingAnswers: Record<string, string> = {};
          data.questions.forEach((q) => {
            if (q.user_response) existingAnswers[q.question_id] = q.user_response;
          });
          setAnswers(existingAnswers);

          if (level === "subtopic") {
            try {
              const sIdxNum = subtopicIdx ? parseInt(subtopicIdx) : 0;
              void enqueueNextSubtopic(studyId, parseInt(chapterIdx), sIdxNum);
            } catch (_) {}
          }
        }
      } catch (error) {
        console.error(error);
        toast({ title: "Error loading quiz", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [studyId, level, chapterIdx, subtopicIdx]);

  // 2. Handle Answer Change
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // helper to compute next route (best-effort) but do NOT navigate here
  const computeNextRoute = async () => {
    if (!studyId || !chapterIdx) return null;
    try {
      const lp = await lessonPlanApi.get(studyId).catch(() => null);
      let nextChapter = parseInt(chapterIdx);
      let nextSubtopic = (subtopicIdx ? parseInt(subtopicIdx) : 0) + 1;
      let totalSub = 0;

      if (lp && lp.lesson_plan && Array.isArray(lp.lesson_plan.chapters)) {
        const chapter = lp.lesson_plan.chapters[parseInt(chapterIdx)];
        totalSub = chapter && Array.isArray(chapter.sub_topics) ? chapter.sub_topics.length : 0;
      }

      if (totalSub === 0) {
        try {
          const cont = await contentApi.get(studyId, parseInt(chapterIdx), 0);
          const generated = cont?.generated_content ?? cont?.content;
          if (Array.isArray(generated)) totalSub = generated.length;
        } catch (_) {}
      }

      if (nextSubtopic < totalSub) {
        return `/content/${nextChapter}/${nextSubtopic}`;
      } else {
        // no more subtopics -> route to chapter test
        return `/study/${studyId}/assignment/chapter/${chapterIdx}/0`;
      }
    } catch (err) {
      // fallback
      return null;
    }
  };

  // 3. Submit Quiz
  const handleSubmit = async () => {
    if (!studyId || !chapterIdx) return;

    if (Object.keys(answers).length < questions.length) {
      toast({ title: "Please answer all questions", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        assignment_level: level as "subtopic" | "chapter" | "subject",
        chapter_idx: parseInt(chapterIdx),
        subtopic_idx: subtopicIdx ? parseInt(subtopicIdx) : undefined,
        responses: Object.entries(answers).map(([qid, ans]) => ({
          question_id: qid,
          user_answer: ans,
        })),
      };

      const response = await assignmentApi.submitAssignment(studyId, payload);

      // compute whether passed (no navigation/marking here)
      const passingThreshold = 60; // adjust if needed
      const passed = response.overall_score >= passingThreshold;

      // attempt to compute nextRoute (best-effort) but do not navigate
      const nextRoute = await computeNextRoute();

      setResult({
        score: response.overall_score,
        feedback: response.feedback_list,
        passed,
        nextRoute,
      });

      toast({ title: "Quiz Submitted!", description: `Score: ${response.overall_score}%` });
      window.scrollTo(0, 0);
    } catch (error) {
      console.error(error);
      toast({ title: "Submission failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Handler for clicking Next Subtopic: mark complete (idempotent) and navigate
  const handleNextSubtopic = async () => {
    if (!studyId || !chapterIdx) return;

    setMarkingProgress(true);
    try {
      // best-effort fetch titles
      let chapterTitle = `Chapter ${chapterIdx}`;
      let subtopicTitle = `Subtopic ${subtopicIdx ?? 0}`;
      try {
        const contentResp = await contentApi.get(studyId, parseInt(chapterIdx), subtopicIdx ? parseInt(subtopicIdx) : 0);
        if (contentResp) {
          chapterTitle = contentResp.chapter_title ?? chapterTitle;
          subtopicTitle = contentResp.title ?? contentResp.subtopic_title ?? subtopicTitle;
        }
      } catch (_) {}

      // mark complete
      try {
        const user = safeGetJson("user") || {};
        const progressPayload = {
          user_id: user?.id || "",
          study_id: studyId,
          chapter_idx: parseInt(chapterIdx),
          subtopic_idx: subtopicIdx ? parseInt(subtopicIdx) : 0,
          chapter_title: chapterTitle,
          subtopic_title: subtopicTitle,
        };
        await progressApi.complete(progressPayload);
        toast({ title: "Marked complete", description: `${subtopicTitle}` });
      } catch (err) {
        console.error("Failed to mark progress:", err);
        // proceed anyway
      }

      // finally navigate to nextRoute if available, else fallback
      if (result?.nextRoute) {
        navigate(result.nextRoute);
      } else {
        // fallback: try to go to next subtopic path computed optimistically
        const fallback = `/study/${studyId}/assignment/chapter/${chapterIdx}/0`;
        navigate(fallback);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Could not go to next subtopic", variant: "destructive" });
    } finally {
      setMarkingProgress(false);
    }
  };

  // Handler to review lesson (go back to content for the same subtopic)
  const handleReviewLesson = () => {
    if (!chapterIdx) return;
    const sIdx = subtopicIdx ? parseInt(subtopicIdx) : 0;
    navigate(`/content/${chapterIdx}/${sIdx}`);
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold capitalize">{level} Assignment</h1>
        {result && (
          <div className="text-xl font-bold px-4 py-2 bg-primary/10 rounded-lg">
            Score: {result.score.toFixed(1)}%
          </div>
        )}
      </div>

      {questions.map((q, idx) => {
        const qFeedback = result?.feedback.find((f) => f.question_id === q.question_id);
        const isReadOnly = !!result;

        return (
          <Card key={q.question_id} className={qFeedback ? (qFeedback.is_correct ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30") : ""}>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex gap-3">
                <span className="opacity-50">{idx + 1}.</span>
                <div className="flex-1">
                  {q.question_text}
                  {qFeedback && (
                    <div className="mt-2 flex items-center gap-2 text-sm font-normal">
                      {qFeedback.is_correct ? (
                        <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Correct</span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1"><XCircle className="w-4 h-4" /> Incorrect</span>
                      )}
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {q.question_type === "mcq" && q.options && (
                <RadioGroup
                  value={answers[q.question_id] || ""}
                  onValueChange={(val) => !isReadOnly && handleAnswerChange(q.question_id, val)}
                  disabled={isReadOnly}
                >
                  {q.options.map((opt) => (
                    <div key={opt.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={opt.id} id={`${q.question_id}-${opt.id}`} />
                      <Label htmlFor={`${q.question_id}-${opt.id}`}>{opt.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {q.question_type === "fill_in_blank" && (
                <Input
                  placeholder="Type your answer..."
                  value={answers[q.question_id] || ""}
                  onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                  disabled={isReadOnly}
                />
              )}

              {q.question_type === "open_ended" && (
                <SpeechTextarea
                  placeholder="Write or speak your response here..."
                  value={answers[q.question_id] || ""}
                  onChange={(v: string) => handleAnswerChange(q.question_id, v)}
                  disabled={isReadOnly}
                  className="min-h-[100px]"
                  ariaLabel={`Answer for question ${idx + 1}`}
                />
              )}

              {qFeedback && (
                <div className="mt-4 p-4 bg-muted/50 rounded-md text-sm">
                  <p className="font-semibold">Feedback:</p>
                  <p>{qFeedback.feedback}</p>
                  {!qFeedback.is_correct && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="font-semibold text-muted-foreground">Explanation:</p>
                      <p className="text-muted-foreground">{q.explanation}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* If no result yet, show submit */}
      {!result && (
        <Button onClick={handleSubmit} disabled={submitting} className="w-full md:w-auto" size="lg">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit Assignment
        </Button>
      )}

      {/* Result UI: show different options depending on pass/fail */}
      {result && (
        <div className="space-y-4">
          <div className="p-4 rounded-md bg-muted/50">
            <h2 className="text-xl font-semibold">Your result</h2>
            <p className="mt-1">Score: <strong>{result.score.toFixed(1)}%</strong></p>
            {result.passed ? (
              <p className="mt-2 text-green-700">Congratulations — you passed! You can proceed to the next subtopic.</p>
            ) : (
              <p className="mt-2 text-red-700">You did not pass. We recommend reviewing the lesson and trying again.</p>
            )}
          </div>

          <div className="flex gap-3">
            {/* If passed, show Next Subtopic (which marks complete then navigates) */}
            {result.passed ? (
              <Button onClick={handleNextSubtopic} disabled={markingProgress} size="lg" className="flex-1">
                {markingProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Next Subtopic
              </Button>
            ) : null}

            {/* Always allow returning to content to review */}
            <Button variant="outline" onClick={handleReviewLesson} className="flex-1" size="lg">
              Review Lesson
            </Button>

            {/* Also keep a Back button */}
            <Button variant="ghost" onClick={() => navigate(-1)} className="w-28">
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

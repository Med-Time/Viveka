import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { assignmentApi } from "./assignment.api";
import { Question, QuestionFeedback } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SpeechTextarea } from "@/components/Question/SpeechTextarea";
import { toast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, XCircle, Download, Award } from "lucide-react";

import { contentApi } from "@/features/content/content.api";
import { progressApi } from "@/features/content/progress.api";
import { lessonPlanApi } from "@/features/lessonPlan/lessonPlan.api";
import { safeGetJson } from "@/utils/storage";
import { slugify } from "@/utils/slug";
import { certificateApi } from "../certificate/certificate.api";

export default function AssignmentPage() {
  const { studyId, level, chapterIdx, subtopicIdx } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [markingProgress, setMarkingProgress] = useState(false);

  // Track subtopic/chapter titles (used to build slugs)
  const [subtopicTitle, setSubtopicTitle] = useState<string>("");
  const [chapterTitle, setChapterTitle] = useState<string>("");

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

  const [certificateData, setCertificateData] = useState<any>(null);
  const [downloadingCert, setDownloadingCert] = useState(false);

  // enqueue next subtopic generation (idempotent, fire-and-forget)
  const enqueueNextSubtopic = async (studyId: string, cIdx: number, sIdx?: number) => {
    try {
      const lp = await lessonPlanApi.get(studyId).catch(() => null);
      let nextChapter = cIdx;
      let nextSubtopic = (sIdx ?? -1) + 1;

      if (lp && lp.lesson_plan && Array.isArray(lp.lesson_plan.chapters)) {
        const chapters = lp.lesson_plan.chapters;
        const chapter = chapters[cIdx];
        const totalSub =
          chapter && Array.isArray(chapter.sub_topics) ? chapter.sub_topics.length : 0;
        if (nextSubtopic >= totalSub) {
          nextChapter = cIdx + 1;
          nextSubtopic = 0;
        }
      } else {
        if (typeof sIdx === "number") nextSubtopic = sIdx + 1;
        else nextSubtopic = 0;
      }

      void contentApi.enqueue(studyId, nextChapter, nextSubtopic).catch(() => null);
    } catch {
      // ignore
    }
  };

  // 1. Fetch Questions on Load + titles
  useEffect(() => {
    if (!studyId || !level || chapterIdx == null) return;

    const fetchQuiz = async () => {
      try {
        setLoading(true);
        let data;
        const cIdx = parseInt(chapterIdx, 10);
        const sIdx = subtopicIdx ? parseInt(subtopicIdx, 10) : 0;

        if (level === "subtopic" && subtopicIdx != null) {
          data = await assignmentApi.getSubtopicQuiz(studyId, cIdx, sIdx);
        } else if (level === "chapter") {
          data = await assignmentApi.getChapterTest(studyId, cIdx);
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

          // Fetch content to get titles (best-effort)
          try {
            // For chapter test or subject, using subtopic 0 is fine for title
            const contentResp = await contentApi.get(studyId, cIdx, sIdx);
            if (contentResp) {
              setChapterTitle(contentResp.chapter_title || `Chapter ${chapterIdx}`);
              setSubtopicTitle(
                contentResp.title ||
                  contentResp.subtopic_title ||
                  `Subtopic ${subtopicIdx || 0}`
              );
            }
          } catch {
            setChapterTitle(`Chapter ${chapterIdx}`);
            setSubtopicTitle(`Subtopic ${subtopicIdx || 0}`);
          }

          if (level === "subtopic") {
            try {
              void enqueueNextSubtopic(studyId, cIdx, sIdx);
            } catch {
              // ignore
            }
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

  const handleSpeechAnswerChange =
    (questionId: string) => (update: string | ((prev: string) => string)) => {
      setAnswers((prev) => {
        const prevVal = prev[questionId] || "";
        const nextVal =
          typeof update === "function"
            ? (update as (p: string) => string)(prevVal)
            : update;
        return { ...prev, [questionId]: nextVal };
      });
    };

  // helper to compute next route (best-effort) but do NOT navigate here
  // NOW returns a **slug-based content URL** when going to next subtopic
  const computeNextRoute = async () => {
    if (!studyId || !chapterIdx) return null;
    try {
      const cIdx = parseInt(chapterIdx, 10);
      const sIdx = subtopicIdx ? parseInt(subtopicIdx, 10) : 0;

      const lp = await lessonPlanApi.get(studyId).catch(() => null);
      let nextChapter = cIdx;
      let nextSubtopic = sIdx + 1;
      let totalSub = 0;

      if (lp && lp.lesson_plan && Array.isArray(lp.lesson_plan.chapters)) {
        const chapter = lp.lesson_plan.chapters[cIdx];
        totalSub =
          chapter && Array.isArray(chapter.sub_topics) ? chapter.sub_topics.length : 0;
      }

      if (totalSub === 0) {
        try {
          const cont = await contentApi.get(studyId, cIdx, 0);
          const generated = cont?.generated_content ?? cont?.content;
          if (Array.isArray(generated)) totalSub = generated.length;
        } catch {
          // ignore
        }
      }

      if (nextSubtopic < totalSub) {
        // go to next subtopic content: build slug URL if we have titles
        if (lp && lp.lesson_plan && Array.isArray(lp.lesson_plan.chapters)) {
          const chapters = lp.lesson_plan.chapters as any[];
          const ch = chapters[nextChapter];
          const chapterTitleNext =
            ch?.chapter_title || `Chapter ${nextChapter + 1}`;
          const subtopicTitleNext =
            ch?.sub_topics?.[nextSubtopic]?.sub_topic_title ||
            `Subtopic ${nextSubtopic + 1}`;

          const nextChapterSlug = encodeURIComponent(slugify(chapterTitleNext));
          const nextSubtopicSlug = encodeURIComponent(slugify(subtopicTitleNext));

          return `/content/${nextChapterSlug}/${nextSubtopicSlug}`;
        }
        // fallback (numeric, in case lesson plan missing)
        return `/content/${nextChapter}/${nextSubtopic}`;
      } else {
        // no more subtopics -> route to chapter test (still numeric-based)
        return `/study/${studyId}/assignment/chapter/${chapterIdx}/0`;
      }
    } catch (err) {
      console.error("computeNextRoute failed:", err);
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
        chapter_idx: parseInt(chapterIdx, 10),
        subtopic_idx: subtopicIdx ? parseInt(subtopicIdx, 10) : undefined,
        responses: Object.entries(answers).map(([qid, ans]) => ({
          question_id: qid,
          user_answer: ans,
        })),
      };

      const response = await assignmentApi.submitAssignment(studyId, payload);

      const passingThreshold = 60;
      const passed = response.overall_score >= passingThreshold;

      const nextRoute = await computeNextRoute();

      setResult({
        score: response.overall_score,
        feedback: response.feedback_list,
        passed,
        nextRoute,
      });

      toast({
        title: "Quiz Submitted!",
        description: `Score: ${response.overall_score}%`,
      });
      window.scrollTo(0, 0);

      if (passed) {
        const flagKey = `assignment_generated:${studyId}:${chapterIdx}:${
          subtopicIdx ? parseInt(subtopicIdx, 10) : 0
        }`;
        localStorage.removeItem(flagKey);

        toast({
          title: "Congratulations! You passed the assignment.",
          description: `Score: ${response.overall_score}%`,
        });
      } else {
        toast({
          title: "You did not pass the assignment.",
          description:
            `Score: ${response.overall_score}%. Please review the lesson and try again.`,
          variant: "destructive",
        });
      }
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
      const cIdx = parseInt(chapterIdx, 10);
      const sIdx = subtopicIdx ? parseInt(subtopicIdx, 10) : 0;

      // best-effort titles (we already set them, but keep fallback)
      let chapterT = chapterTitle || `Chapter ${chapterIdx}`;
      let subtopicT = subtopicTitle || `Subtopic ${subtopicIdx ?? 0}`;
      try {
        const contentResp = await contentApi.get(studyId, cIdx, sIdx);
        if (contentResp) {
          chapterT = contentResp.chapter_title ?? chapterT;
          subtopicT =
            contentResp.title ?? contentResp.subtopic_title ?? subtopicT;
        }
      } catch {
        // ignore
      }

      try {
        const user = safeGetJson("user") || {};
        const progressPayload = {
          user_id: user?.id || "",
          study_id: studyId,
          chapter_idx: cIdx,
          subtopic_idx: sIdx,
          chapter_title: chapterT,
          subtopic_title: subtopicT,
        };
        await progressApi.complete(progressPayload);
        toast({ title: "Marked complete", description: `${subtopicT}` });
      } catch (err) {
        console.error("Failed to mark progress:", err);
        // proceed anyway
      }

      if (result?.nextRoute) {
        navigate(result.nextRoute);
      } else {
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

  // Handler to review lesson (go back to content for the SAME subtopic using slugs)
  const handleReviewLesson = () => {
    // Build slugs from titles (this does NOT depend on assignment URL structure)
    const chapterBase =
      chapterTitle || (chapterIdx != null ? `Chapter ${chapterIdx}` : "chapter");
    const subtopicBase =
      subtopicTitle ||
      (subtopicIdx != null ? `Subtopic ${subtopicIdx}` : "subtopic");

    const chapterSlug = encodeURIComponent(slugify(chapterBase));
    const subtopicSlug = encodeURIComponent(slugify(subtopicBase));

    navigate(`/content/${chapterSlug}/${subtopicSlug}`);
  };

  // Subject-level certificate redirect
  useEffect(() => {
    if (result?.passed && level === "subject" && certificateData && studyId) {
      setTimeout(() => {
        navigate(`/certificate/${studyId}`);
      }, 1500);
    }
  }, [result?.passed, level, studyId, certificateData, navigate]);

  const handleDownloadCertificate = async () => {
    if (!studyId) return;
    setDownloadingCert(true);
    try {
      await certificateApi.downloadCertificate(studyId);
      toast({
        title: "Certificate downloaded",
        description: "Your PDF certificate is ready.",
      });
    } catch (err) {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloadingCert(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h2 className="text-sm text-muted-foreground mb-2">{chapterTitle}</h2>
          <h1 className="text-3xl font-bold">
            Assignment Of{" "}
            {level === "subtopic"
              ? subtopicTitle
              : level === "chapter"
              ? `${chapterTitle} Test`
              : "Final Capstone"}
          </h1>
        </div>
        {result && (
          <div className="text-xl font-bold px-4 py-2 bg-primary/10 rounded-lg">
            Score: {result.score.toFixed(1)}%
          </div>
        )}
      </div>

      {questions.map((q, idx) => {
        const qFeedback = result?.feedback.find(
          (f) => f.question_id === q.question_id
        );
        const isReadOnly = !!result;

        return (
          <Card
            key={q.question_id}
            className={
              qFeedback
                ? qFeedback.is_correct
                  ? "border-green-200 bg-green-50/30"
                  : "border-red-200 bg-red-50/30"
                : ""
            }
          >
            <CardHeader>
              <CardTitle className="text-lg font-medium flex gap-3">
                <span className="opacity-50">{idx + 1}.</span>
                <div className="flex-1">
                  {q.question_text}
                  {qFeedback && (
                    <div className="mt-2 flex items-center gap-2 text-sm font-normal">
                      {qFeedback.is_correct ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Correct
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Incorrect
                        </span>
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
                  onValueChange={(val) =>
                    !isReadOnly && handleAnswerChange(q.question_id, val)
                  }
                  disabled={isReadOnly}
                >
                  {q.options.map((opt) => (
                    <div key={opt.id} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={opt.id}
                        id={`${q.question_id}-${opt.id}`}
                      />
                      <Label htmlFor={`${q.question_id}-${opt.id}`}>
                        {opt.text}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {q.question_type === "fill_in_blank" && (
                <Input
                  placeholder="Type your answer..."
                  value={answers[q.question_id] || ""}
                  onChange={(e) =>
                    handleAnswerChange(q.question_id, e.target.value)
                  }
                  disabled={isReadOnly}
                />
              )}

              {q.question_type === "open_ended" && (
                <SpeechTextarea
                  value={answers[q.question_id] || ""}
                  onChange={handleSpeechAnswerChange(q.question_id)}
                  disabled={isReadOnly}
                  placeholder="Write or speak your response here..."
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
                      <p className="font-semibold text-muted-foreground">
                        Explanation:
                      </p>
                      <p className="text-muted-foreground">
                        {q.explanation}
                      </p>
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
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full md:w-auto"
          size="lg"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Submit Assignment
        </Button>
      )}

      {/* Result UI */}
      {result && (
        <div className="space-y-4">
          <div className="p-4 rounded-md bg-muted/50">
            <h2 className="text-xl font-semibold">Your result</h2>
            <p className="mt-1">
              Score: <strong>{result.score.toFixed(1)}%</strong>
            </p>
            {result.passed ? (
              <p className="mt-2 text-green-700">
                Congratulations — you passed! You can proceed to the next
                subtopic.
              </p>
            ) : (
              <p className="mt-2 text-red-700">
                You did not pass. We recommend reviewing the lesson and trying
                again.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            {result.passed ? (
              <Button
                onClick={handleNextSubtopic}
                disabled={markingProgress}
                size="lg"
                className="flex-1"
              >
                {markingProgress ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Next Subtopic
              </Button>
            ) : null}

            <Button
              variant="outline"
              onClick={handleReviewLesson}
              className="flex-1"
              size="lg"
            >
              Review Lesson
            </Button>

            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="w-28"
            >
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Certificate UI for subject level (optional) */}
      {result?.passed && level === "subject" && certificateData && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Award className="w-6 h-6" />
              Congratulations! You've Earned a Certificate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-md border border-green-200">
              <p className="text-sm text-muted-foreground">
                Certificate of Completion
              </p>
              <p className="text-lg font-semibold mt-2">
                {certificateData.student_name}
              </p>
              <p className="text-sm mt-1">
                Course: <strong>{certificateData.course_title}</strong>
              </p>
              <p className="text-sm mt-1">
                Completed:{" "}
                <strong>
                  {new Date(
                    certificateData.completion_date
                  ).toLocaleDateString()}
                </strong>
              </p>
            </div>
            <Button
              onClick={handleDownloadCertificate}
              disabled={downloadingCert}
              className="w-full"
            >
              {downloadingCert ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download Certificate (PDF)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

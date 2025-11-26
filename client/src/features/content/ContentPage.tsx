import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check, ZoomIn, ZoomOut } from "lucide-react";
import { contentApi } from "./content.api";
import { ReferencesPanel } from "./ReferencesPanel";
import { progressApi, ProgressCompleteRequest } from "./progress.api";
import { queryKeys } from "@/api/queryKeys";
import { toast } from "@/hooks/use-toast";
import { safeGetJson, safeSetJson } from "@/utils/storage";
import { lessonPlanApi } from "@/features/lessonPlan/lessonPlan.api";
import { assignmentApi } from "@/features/assignment/assignment.api";
import Assistant from "../ai_assistant/assistant";
import Assistant_style from "../ai_assistant/assistant_style.module.css";
import { quizStatusApi } from "@/features/assignment/quizStatus.api";
import { slugify } from "@/utils/slug";

export const ContentPage = () => {
  // slugs from URL
  const { chapterSlug = "", subtopicSlug = "" } = useParams<{
    chapterSlug: string;
    subtopicSlug: string;
  }>();

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const auth = safeGetJson("user") || {};
  const persisted = localStorage.getItem("current_study_id");
  const userStudies = auth?.studies || [];
  const validPersisted =
    persisted && userStudies.some((s: any) => s.study_id === persisted) ? persisted : null;
  const initial =
    validPersisted || userStudies?.[0]?.study_id || auth?.current_study_id || null;

  const progressMutation = useMutation({
    mutationFn: (payload: ProgressCompleteRequest) => progressApi.complete(payload),
  });

  const [currentStudyId] = useState<string | null>(initial);
  const [fontSize, setFontSize] = useState(16);
  const studyID = currentStudyId;

  const [hasGenerated, setHasGenerated] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  // Lesson plan: used to resolve slugs -> indices
  const { data: lessonPlan } = useQuery({
    queryKey: queryKeys.lessonPlan.get(studyID),
    queryFn: () => lessonPlanApi.get(studyID),
    enabled: !!studyID,
    staleTime: 1000 * 60, // 1 minute
  });

  // Resolve chapterIdx + subtopicIdx from slugs using the lesson plan
  const { chapterIdx, subtopicIdx } = useMemo(() => {
    if (
      !lessonPlan ||
      !lessonPlan.lesson_plan ||
      !Array.isArray(lessonPlan.lesson_plan.chapters)
    ) {
      // fallback if lesson plan not loaded – indices 0,0
      return { chapterIdx: 0, subtopicIdx: 0 };
    }

    const chapters = lessonPlan.lesson_plan.chapters as any[];

    // find chapter by slug
    let cIdx = chapters.findIndex(
      (ch: any) =>
        ch && typeof ch.chapter_title === "string" &&
        slugify(ch.chapter_title) === decodeURIComponent(chapterSlug)
    );
    if (cIdx < 0) cIdx = 0;

    const chapter = chapters[cIdx];
    let sIdx = 0;

    if (chapter && Array.isArray(chapter.sub_topics) && chapter.sub_topics.length > 0) {
      if (subtopicSlug) {
        const sFound = chapter.sub_topics.findIndex(
          (s: any) =>
            s && typeof s.sub_topic_title === "string" &&
            slugify(s.sub_topic_title) === decodeURIComponent(subtopicSlug)
        );
        sIdx = sFound >= 0 ? sFound : 0;
      } else {
        sIdx = 0;
      }
    }

    return { chapterIdx: cIdx, subtopicIdx: sIdx };
  }, [lessonPlan, chapterSlug, subtopicSlug]);

  // Content query: uses resolved indices
  const { data: content, isLoading } = useQuery({
    queryKey: queryKeys.content.get(studyID, chapterIdx, subtopicIdx),
    queryFn: () => contentApi.get(studyID, chapterIdx, subtopicIdx),
    enabled: hasGenerated === true && !!studyID,
  });

  // enqueue generation (non-blocking) and poll job status
  const enqueueAndPoll = async () => {
    if (!studyID) return null;

    try {
      const res = await contentApi.enqueue(studyID, chapterIdx, subtopicIdx);
      const jobId = res.job_id;
      toast({
        title: "Generation queued",
        description: "Content generation is running in background.",
      });

      let attempts = 0;
      const maxAttempts = 60; // ~5 minutes at 5s interval
      const interval = 5000;

      while (attempts < maxAttempts) {
        attempts += 1;
        try {
          const job = await contentApi.getJob(jobId);
          if (!job) {
            await new Promise((r) => setTimeout(r, interval));
            continue;
          }
          if (job.status === "ready") {
            setHasGenerated(true);
            queryClient.invalidateQueries(
              queryKeys.content.get(studyID, chapterIdx, subtopicIdx)
            );
            toast({
              title: "Content ready",
              description: "Your content has been generated.",
            });
            break;
          }
          if (job.status === "failed") {
            toast({
              title: "Generation failed",
              description: job.error || "See server logs.",
              variant: "destructive",
            });
            break;
          }
        } catch {
          // ignore transient errors
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    } catch (e: any) {
      toast({
        title: "Failed to enqueue generation",
        description: e?.message || String(e),
        variant: "destructive",
      });
    }
  };

  // initial check: does content already exist or should we enqueue?
  useEffect(() => {
    if (!studyID) {
      setHasGenerated(false);
      return;
    }

    let mounted = true;

    (async () => {
      setChecking(true);
      try {
        const existing = await contentApi.get(studyID, chapterIdx, subtopicIdx);

        if (!mounted) return;

        const hasMeaningfulContent =
          existing &&
          (
            (existing as any).generated_content ||
            (existing as any).content ||
            (existing as any).chapter_title ||
            (Object.keys(existing || {}).length > 0)
          );

        if (hasMeaningfulContent) {
          setHasGenerated(true);
        } else {
          setHasGenerated(false);
          void enqueueAndPoll();
        }
      } catch {
        if (!mounted) return;
        setHasGenerated(false);
        void enqueueAndPoll();
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [studyID, chapterIdx, subtopicIdx]);

  const normalizeGenerated = (raw: any): { title: string; body: string }[] => {
    const out: { title: string; body: string }[] = [];
    if (!raw) return out;

    if (Array.isArray(raw)) {
      raw.forEach((item: any, i: number) => {
        if (typeof item === "string") out.push({ title: `Subtopic ${i + 1}`, body: item });
        else if (item && typeof item === "object") {
          const title = item.title || item.subtopic_title || `Subtopic ${i + 1}`;
          const body = item.content || item.text || item.body || JSON.stringify(item);
          out.push({ title, body });
        } else out.push({ title: `Subtopic ${i + 1}`, body: String(item) });
      });
      return out;
    }

    if (typeof raw === "object") {
      if ((raw.title && raw.content) || (raw.chapter_title && raw.generated_content)) {
        const generated =
          raw.generated_content ?? raw.content ?? raw.body ?? raw.text;
        if (generated) return normalizeGenerated(generated);
        const t = raw.title || raw.chapter_title || "Subtopic 1";
        const b = raw.content || raw.generated_content || JSON.stringify(raw);
        return [{ title: t, body: b }];
      }

      Object.entries(raw).forEach(([k, v]) => {
        if (typeof v === "string") out.push({ title: k, body: v });
        else if (v && typeof v === "object") {
          const body = (v as any).content || (v as any).text || (v as any).body || JSON.stringify(v);
          out.push({ title: k, body });
        } else out.push({ title: k, body: String(v) });
      });
      return out;
    }

    if (typeof raw === "string") return [{ title: "Subtopic 1", body: raw }];
    return out;
  };

  // references (still index-based for backend)
  const {
    data: referencesData,
    isLoading: refsLoading,
    error: refsError,
  } = useQuery({
    queryKey: ["content-references", studyID, chapterIdx, subtopicIdx],
    queryFn: () => contentApi.getReferences(studyID, chapterIdx, subtopicIdx),
    enabled: !!studyID && hasGenerated === true,
    staleTime: 1000 * 60 * 5,
  });

  const generatedRaw =
    (content as any)?.generated_content ?? (content as any)?.content ?? content;
  const normalizedSubtopics = normalizeGenerated(generatedRaw);

  const totalSubtopicsFromLessonPlan = (() => {
    try {
      if (
        lessonPlan &&
        lessonPlan.lesson_plan &&
        Array.isArray(lessonPlan.lesson_plan.chapters)
      ) {
        const ch = lessonPlan.lesson_plan.chapters[chapterIdx];
        if (ch && Array.isArray(ch.sub_topics)) return ch.sub_topics.length;
      }
    } catch {
      // ignore
    }
    return undefined;
  })();

  const totalSubtopics =
    typeof totalSubtopicsFromLessonPlan === "number" &&
    !isNaN(totalSubtopicsFromLessonPlan)
      ? totalSubtopicsFromLessonPlan
      : normalizedSubtopics.length;

  const currentIdx = Math.max(
    0,
    Math.min(
      Math.max(0, totalSubtopics - 1),
      isNaN(subtopicIdx) ? 0 : subtopicIdx
    )
  );

  const currentTitle =
    (content as any)?.title ??
    (normalizedSubtopics[currentIdx] && normalizedSubtopics[currentIdx].title) ??
    (content as any)?.subtopic_title ??
    "";

  const currentContent =
    (normalizedSubtopics[currentIdx] && normalizedSubtopics[currentIdx].body) ??
    (content as any)?.content ??
    (content as any)?.body ??
    "";

  const isLastSubtopic = currentIdx === totalSubtopics - 1;

  // helper: navigate using slugs derived from lesson plan titles
  const navigateToSubtopic = (targetChapterIdx: number, targetSubtopicIdx: number) => {
    if (
      !lessonPlan ||
      !lessonPlan.lesson_plan ||
      !Array.isArray(lessonPlan.lesson_plan.chapters)
    ) {
      // fallback: indices in URL (not ideal, but safe)
      navigate(`/content/${targetChapterIdx}/${targetSubtopicIdx}`);
      setHasGenerated(null);
      return;
    }

    const chapters = lessonPlan.lesson_plan.chapters as any[];
    const ch = chapters[targetChapterIdx];
    const chapterTitle = ch?.chapter_title || `chapter-${targetChapterIdx + 1}`;
    const subtopicTitle =
      ch?.sub_topics?.[targetSubtopicIdx]?.sub_topic_title ||
      `subtopic-${targetSubtopicIdx + 1}`;

    const nextChapterSlug = encodeURIComponent(slugify(chapterTitle));
    const nextSubtopicSlug = encodeURIComponent(slugify(subtopicTitle));

    navigate(`/content/${nextChapterSlug}/${nextSubtopicSlug}`);
    setHasGenerated(null);
  };

  const enqueueNextForNavigation = (overrideNextChapter?: number, overrideNextSubtopic?: number) => {
    try {
      let nextChapter =
        typeof overrideNextChapter === "number" ? overrideNextChapter : chapterIdx;
      let nextSubtopic =
        typeof overrideNextSubtopic === "number"
          ? overrideNextSubtopic
          : currentIdx + 1;

      if (
        lessonPlan &&
        lessonPlan.lesson_plan &&
        Array.isArray(lessonPlan.lesson_plan.chapters)
      ) {
        const chapters = lessonPlan.lesson_plan.chapters as any[];
        const currChapter = chapters[chapterIdx];
        const currCount =
          currChapter && Array.isArray(currChapter.sub_topics)
            ? currChapter.sub_topics.length
            : 0;
        if (currCount && nextSubtopic >= currCount) {
          nextChapter = chapterIdx + 1;
          nextSubtopic = 0;
        }
      }

      void contentApi.enqueue(studyID || "", nextChapter, nextSubtopic).catch(() => null);
    } catch {
      // ignore
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 < totalSubtopics) {
      navigateToSubtopic(chapterIdx, currentIdx + 1);
    } else {
      navigateToSubtopic(chapterIdx + 1, 0);
    }
  };

  // PROGRESS + QUIZ

  const [assistantOpen, setAssistantOpen] = useState(false);
  const context = { studyId: studyID, chapterIdx, subtopicIdx: currentIdx };

  const [quizTaken, setQuizTaken] = useState<boolean>(false);
  const [quizPassed, setQuizPassed] = useState<boolean>(false);
  const [quizLoading, setQuizLoading] = useState<boolean>(false);
  const hoverToastShownRef = useRef<boolean>(false);

  useEffect(() => {
    if (!studyID) {
      setQuizTaken(false);
      setQuizPassed(false);
      return;
    }
    let mounted = true;
    (async () => {
      setQuizLoading(true);
      try {
        const resp = await quizStatusApi
          .get(studyID, chapterIdx, currentIdx)
          .catch(() => ({ found: false, status: "From Frontend" }));
        console.log("Quiz status response:", resp);
        if (!mounted) return;
        if (resp && resp.found) {
          setQuizTaken(Boolean(resp.status.score !== null));
          setQuizPassed(Boolean(resp.status?.passed));
        } else {
          setQuizTaken(false);
          setQuizPassed(false);
        }
      } catch {
        setQuizTaken(false);
        setQuizPassed(false);
      } finally {
        if (mounted) setQuizLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [studyID, chapterIdx, currentIdx]);

  // Mark Complete: keep as "go to quiz" (server will mark completion after pass)
  const handleMarkCompleteClick = () => {
    if (!studyID) {
      toast({
        title: "Missing study",
        description: "Cannot start quiz: missing study id",
        variant: "destructive",
      });
      return;
    }
    try {
      enqueueNextForNavigation();
    } catch {
      // ignore
    }
    navigate(`/study/${studyID}/assignment/subtopic/${chapterIdx}/${currentIdx}`);
  };

  const onNextClickWhenLocked = () => {
    toast({
      title: "Take quiz first",
      description: "Please take and pass the subtopic quiz before moving to next.",
      variant: "destructive",
    });
  };

  // Enqueue assignment generation first time subtopic is opened
  useEffect(() => {
    if (!studyID) return;
    const key = `assignment_generated:${studyID}:${chapterIdx}:${currentIdx}`;
    const already = localStorage.getItem(key);
    if (already) return;

    let mounted = true;
    (async () => {
      try {
        const exists = await assignmentApi
          .getSubtopicQuiz(studyID, chapterIdx, currentIdx)
          .then(() => true)
          .catch(() => false);

        if (!mounted) return;

        if (!exists) {
          try {
            if (assignmentApi.generateSubtopic) {
              void assignmentApi
                .generateSubtopic(studyID, chapterIdx, currentIdx)
                .catch(() => null);
            } else {
              void fetch(
                `/iiismart-assignment/subtopic/${encodeURIComponent(
                  studyID
                )}/${chapterIdx}/${currentIdx}`,
                {
                  method: "POST",
                }
              ).catch(() => null);
            }
          } catch {
            // ignore
          }
        }

        localStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, [studyID, chapterIdx, currentIdx]);

  // PROGRESS SAVE (still index-based)
  const handleComplete = async () => {
    if (!studyID) {
      toast({ title: "Missing study ID", variant: "destructive" });
      return;
    }

    const newEntry = {
      study_id: studyID,
      chapterIdx,
      subtopicIdx: currentIdx,
      chapterTitle: (content as any)?.chapter_title ?? `Chapter ${chapterIdx}`,
      subtopicTitle: currentTitle || `Subtopic ${currentIdx + 1}`,
    };

    const payload: ProgressCompleteRequest = {
      user_id: auth?.id || "",
      study_id: newEntry.study_id,
      chapter_idx: newEntry.chapterIdx,
      subtopic_idx: newEntry.subtopicIdx,
      chapter_title: newEntry.chapterTitle,
      subtopic_title: newEntry.subtopicTitle,
    };

    const lessonPlanKey = queryKeys.lessonPlan.get(studyID);
    const previousLessonPlan = queryClient.getQueryData<any>(lessonPlanKey);
    const snapshot = previousLessonPlan ? JSON.parse(JSON.stringify(previousLessonPlan)) : null;

    if (
      previousLessonPlan &&
      previousLessonPlan.lesson_plan &&
      Array.isArray(previousLessonPlan.lesson_plan.chapters)
    ) {
      try {
        const chapters = previousLessonPlan.lesson_plan.chapters.map((ch: any, idx: number) => {
          if (idx !== chapterIdx) return ch;
          const cloned = {
            ...ch,
            sub_topics: Array.isArray(ch.sub_topics) ? [...ch.sub_topics] : [],
          };
          if (!Array.isArray(cloned.sub_topics)) cloned.sub_topics = [];
          cloned.sub_topics = cloned.sub_topics.map((sub: any, sidx: number) => {
            if (sidx !== currentIdx) return sub;
            return {
              ...sub,
              completed: true,
              completed_at: new Date().toISOString(),
            };
          });
          return cloned;
        });

        const optimistic = {
          ...previousLessonPlan,
          lesson_plan: {
            ...previousLessonPlan.lesson_plan,
            chapters,
          },
        };
        queryClient.setQueryData(lessonPlanKey, optimistic);
      } catch {
        // ignore
      }
    }

    const existingData = safeGetJson("last_read");
    let updatedData: any[] = [];
    if (Array.isArray(existingData)) {
      const index = existingData.findIndex((i) => i.study_id === studyID);
      if (index !== -1) {
        existingData[index] = newEntry;
        updatedData = existingData;
      } else updatedData = [...existingData, newEntry];
    } else if (existingData && typeof existingData === "object" && existingData.study_id) {
      updatedData =
        existingData.study_id === studyID ? [existingData] : [existingData, newEntry];
    } else updatedData = [newEntry];

    safeSetJson("last_read", updatedData);

    try {
      await progressMutation.mutateAsync(payload);
      toast({
        title: "Progress saved!",
        description: `Marked complete: ${newEntry.subtopicTitle}`,
      });
    } catch (err: any) {
      if (snapshot) {
        queryClient.setQueryData(lessonPlanKey, snapshot);
      }
      toast({
        title: "Failed to save progress",
        description:
          err instanceof Error ? err.message : "Could not save progress to server.",
        variant: "destructive",
      });
    }
  };

  // LOADING / EMPTY STATES

  if (checking || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">
              {checking ? "Checking for existing content..." : "Loading chapter content..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasGenerated === false) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              No content exists for this chapter yet.
            </p>
            <Button onClick={() => void enqueueAndPoll()}>Queue Generation</Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Content not available.</p>
          </Card>
        </div>
      </div>
    );
  }

  // MAIN RENDER

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className={Assistant_style.container}>
        {/* Floating AI Assistant button */}
        <button
          onClick={() => setAssistantOpen(true)}
          className="
            fixed bottom-6 right-6 z-50
            bg-blue-600 text-white
            px-4 py-2 rounded-lg shadow-lg
            hover:bg-blue-700
            focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500
          "
          type="button"
          title="Need help?"
        >
          💬 AI Assistant
        </button>

        {/* Floating Back to Lesson Plan button */}
        <Button
          variant="outline"
          className="fixed bottom-6 left-6 z-50 shadow-md"
          onClick={() => navigate(`/lesson-plan`)}
        >
          ← Back to Lesson Plan
        </Button>

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold">{currentTitle}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Card className="mb-6 p-8" style={{ fontSize: `${fontSize}px` }}>
                <MarkdownRenderer
                  content={currentContent || "No content for this subtopic."}
                />
              </Card>

              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (currentIdx > 0) navigateToSubtopic(chapterIdx, currentIdx - 1);
                    else if (chapterIdx > 0) navigateToSubtopic(chapterIdx - 1, 0);
                  }}
                  disabled={chapterIdx === 0 && currentIdx === 0}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                <div className="flex gap-2">
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      try {
                        enqueueNextForNavigation();
                      } catch {
                        // ignore
                      }
                      navigate(
                        `/study/${studyID}/assignment/subtopic/${chapterIdx}/${currentIdx}`
                      );
                    }}
                  >
                    Take Quiz
                  </Button>

                  {quizPassed ? (
                    <Button variant="secondary" disabled>
                      <Check className="mr-2 h-4 w-4" />
                      Completed
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={handleMarkCompleteClick}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark Complete
                    </Button>
                  )}
                </div>

                {isLastSubtopic ? (
                  <span
                    title={
                      !quizTaken
                        ? "Please take the quiz for this subtopic first"
                        : !quizPassed
                        ? "You must pass the quiz to attempt the chapter test"
                        : ""
                    }
                  >
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        if (!quizTaken || !quizPassed) {
                          onNextClickWhenLocked();
                          return;
                        }
                        navigate(`/study/${studyID}/assignment/chapter/${chapterIdx}/0`);
                      }}
                      disabled={!(quizTaken && quizPassed)}
                    >
                      Take Chapter Test
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </span>
                ) : (
                  <span
                    title={
                      !quizTaken
                        ? "Please take the quiz first"
                        : "You must pass the quiz to proceed"
                    }
                  >
                    <Button
                      onClick={() => {
                        if (!quizTaken || !quizPassed) {
                          onNextClickWhenLocked();
                          return;
                        }
                        void handleNext();
                      }}
                      disabled={!(quizTaken && quizPassed)}
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </span>
                )}
              </div>
            </div>

            {/* Sidebar: References */}
            <div className="lg:col-span-1 space-y-4">
              <ReferencesPanel
                references={(referencesData as any)?.references}
                isLoading={refsLoading}
                error={refsError?.message}
              />
            </div>
          </div>

          <Assistant
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            context={context}
          />
        </div>
      </div>
    </div>
  );
};

// src/features/content/ContentPage.tsx
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check, ZoomIn, ZoomOut } from "lucide-react";
import { contentApi } from "./content.api";
import { progressApi, ProgressCompleteRequest } from "./progress.api";
import { queryKeys } from "@/api/queryKeys";
import { toast } from "@/hooks/use-toast";
import { safeGetJson, safeSetJson } from "@/utils/storage";
// NEW import: lesson plan API
import { lessonPlanApi } from "@/features/lessonPlan/lessonPlan.api";
// NEW import: assignment API (used to check/generate subtopic assignment)
import { assignmentApi } from "@/features/assignment/assignment.api";
import Assistant from "../ai_assistant/assistant";
import Assistant_style from "../ai_assistant/assistant_style.module.css";
import { quizStatusApi } from "@/features/assignment/quizStatus.api";

export const ContentPage = () => {
  const params = useParams<Record<string, string>>();
  const chapterIdx = parseInt(params.chapter_idx || "0", 10);
  const subtopicIdx = parseInt(params.subtopic_idx || "0", 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const auth = safeGetJson("user") || {};
  const persisted = localStorage.getItem("current_study_id");
  const userStudies = auth?.studies || [];
  const validPersisted =
    persisted && userStudies.some((s: any) => s.study_id === persisted) ? persisted : null;
  const initial = validPersisted || userStudies?.[0]?.study_id || auth?.current_study_id || null;

  const [currentStudyId, setCurrentStudyId] = useState<string | null>(initial);
  const [fontSize, setFontSize] = useState(16);
  const studyID = currentStudyId;

  const [hasGenerated, setHasGenerated] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const { data: content, isLoading, refetch } = useQuery({
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
      toast({ title: "Generation queued", description: "Content generation is running in background." });

      // poll job status until ready
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
            // refresh content
            queryClient.invalidateQueries(queryKeys.content.get(studyID, chapterIdx, subtopicIdx));
            toast({ title: "Content ready", description: "Your content has been generated." });
            break;
          }
          if (job.status === "failed") {
            toast({ title: "Generation failed", description: job.error || "See server logs.", variant: "destructive" });
            break;
          }
        } catch (e) {
          // ignore transient errors and keep polling
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    } catch (e: any) {
      toast({ title: "Failed to enqueue generation", description: e?.message || String(e), variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!studyID) {
      setHasGenerated(false);
      return;
    }

    let mounted = true;

    (async () => {
      setChecking(true);
      try {
        // Try to fetch existing content; non-blocking UI
        // NOTE: check the returned payload for meaningful content; some backends
        // may return 200 with empty payload rather than throwing a 404.
        const existing = await contentApi.get(studyID, chapterIdx, subtopicIdx);

        if (!mounted) return;

        const hasMeaningfulContent =
          existing &&
          (
            // common content fields we care about
            (existing as any).generated_content ||
            (existing as any).content ||
            (existing as any).chapter_title ||
            // or object with more than a couple of keys
            (Object.keys(existing || {}).length > 0)
          );

        if (hasMeaningfulContent) {
          setHasGenerated(true);
        } else {
          // treat empty/placeholder responses as "no content" and enqueue
          setHasGenerated(false);
          void enqueueAndPoll();
        }
      } catch (_err: any) {
        if (!mounted) return;
        // No content yet or fetch error: enqueue generation silently (idempotent)
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
      // If raw is a wrapper like { title, content } or { chapter_title, generated_content }
      if ((raw.title && raw.content) || (raw.chapter_title && raw.generated_content)) {
        const generated = raw.generated_content ?? raw.content ?? raw.body ?? raw.text;
        if (generated) return normalizeGenerated(generated);
        const t = raw.title || raw.chapter_title || "Subtopic 1";
        const b = raw.content || raw.generated_content || JSON.stringify(raw);
        return [{ title: t, body: b }];
      }

      Object.entries(raw).forEach(([k, v]) => {
        if (typeof v === "string") out.push({ title: k, body: v });
        else if (v && typeof v === "object") {
          const body = v.content || v.text || v.body || JSON.stringify(v);
          out.push({ title: k, body });
        } else out.push({ title: k, body: String(v) });
      });
      return out;
    }

    if (typeof raw === "string") return [{ title: "Subtopic 1", body: raw }];
    return out;
  };

  // NEW: fetch lesson plan in parallel (authoritative source for chapter/subtopic counts)
  const { data: lessonPlan, isLoading: lpLoading, refetch: refetchLessonPlan } = useQuery({
    queryKey: queryKeys.lessonPlan.get(studyID),
    queryFn: () => lessonPlanApi.get(studyID),
    enabled: !!studyID,
    staleTime: 1000 * 60, // 1 minute
  });

  // try various fields the backend might have used
  const generatedRaw = (content as any)?.generated_content ?? (content as any)?.content ?? content;
  const normalizedSubtopics = normalizeGenerated(generatedRaw);

  // PRIMARY source of truth for total subtopics: lesson plan (if available)
  const totalSubtopicsFromLessonPlan = (() => {
    try {
      if (lessonPlan && lessonPlan.lesson_plan && Array.isArray(lessonPlan.lesson_plan.chapters)) {
        const ch = lessonPlan.lesson_plan.chapters[chapterIdx];
        if (ch && Array.isArray(ch.sub_topics)) return ch.sub_topics.length;
      }
    } catch (e) {
      // ignore and fallback
    }
    return undefined;
  })();

  // final totalSubtopics: prefer lesson plan count, else fall back to normalizedSubtopics length
  const totalSubtopics = typeof totalSubtopicsFromLessonPlan === "number" && !isNaN(totalSubtopicsFromLessonPlan)
    ? totalSubtopicsFromLessonPlan
    : normalizedSubtopics.length;

  // ensure currentIdx is bounded by authoritative totalSubtopics
  const currentIdx = Math.max(0, Math.min(Math.max(0, totalSubtopics - 1), isNaN(subtopicIdx) ? 0 : subtopicIdx));

  // Use normalized subtopic title/body as primary source.
  const currentTitle = (content as any)?.title ??
    (normalizedSubtopics[currentIdx] && normalizedSubtopics[currentIdx].title) ??
    (content as any)?.subtopic_title ?? "";
  const currentContent =
    (normalizedSubtopics[currentIdx] && normalizedSubtopics[currentIdx].body) ?? (content as any)?.content ?? (content as any)?.body ?? "";

  const isLastSubtopic = currentIdx === totalSubtopics - 1;

  // Update enqueue logic: compute next using lesson-plan counts when available
  const enqueueNextForNavigation = (overrideNextChapter?: number, overrideNextSubtopic?: number) => {
    try {
      let nextChapter = typeof overrideNextChapter === "number" ? overrideNextChapter : chapterIdx;
      let nextSubtopic = typeof overrideNextSubtopic === "number" ? overrideNextSubtopic : currentIdx + 1;

      // Use lesson plan to correct roll-over when subtopic exceeds chapter's sub_topics
      if (lessonPlan && lessonPlan.lesson_plan && Array.isArray(lessonPlan.lesson_plan.chapters)) {
        const chapters = lessonPlan.lesson_plan.chapters;
        const currChapter = chapters[chapterIdx];
        const currCount = currChapter && Array.isArray(currChapter.sub_topics) ? currChapter.sub_topics.length : 0;
        if (currCount && nextSubtopic >= currCount) {
          nextChapter = chapterIdx + 1;
          nextSubtopic = 0;
        }
      }

      // fire-and-forget enqueue; idempotent endpoint on server
      void contentApi.enqueue(studyID || "", nextChapter, nextSubtopic).catch(() => null);
    } catch (e) {
      // noop - non-blocking
    }
  };

  // handleComplete with optimistic update to lessonPlan
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

    // --- optimistic update: update lesson plan cache immediately ---
    const lessonPlanKey = queryKeys.lessonPlan.get(studyID);
    const previousLessonPlan = queryClient.getQueryData<any>(lessonPlanKey);

    // snapshot for rollback
    const snapshot = previousLessonPlan ? JSON.parse(JSON.stringify(previousLessonPlan)) : null;

    if (previousLessonPlan && previousLessonPlan.lesson_plan && Array.isArray(previousLessonPlan.lesson_plan.chapters)) {
      try {
        const chapters = previousLessonPlan.lesson_plan.chapters.map((ch: any, idx: number) => {
          if (idx !== chapterIdx) return ch;
          // clone chapter
          const cloned = { ...ch, sub_topics: Array.isArray(ch.sub_topics) ? [...ch.sub_topics] : [] };
          // ensure subtopics exist
          if (!Array.isArray(cloned.sub_topics)) cloned.sub_topics = [];
          // mark the specific subtopic as completed
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

        // apply optimistic update
        const optimistic = {
          ...previousLessonPlan,
          lesson_plan: {
            ...previousLessonPlan.lesson_plan,
            chapters,
          },
        };
        queryClient.setQueryData(lessonPlanKey, optimistic);
      } catch (e) {
        // if optimistic update fails, ignore and proceed to network call
      }
    }

    // also update local last_read immediately (same as before)
    const existingData = safeGetJson("last_read");
    let updatedData: any[] = [];
    if (Array.isArray(existingData)) {
      const index = existingData.findIndex((i) => i.study_id === studyID);
      if (index !== -1) {
        existingData[index] = newEntry;
        updatedData = existingData;
      } else updatedData = [...existingData, newEntry];
    } else if (existingData && typeof existingData === "object" && existingData.study_id) {
      updatedData = existingData.study_id === studyID ? [newEntry] : [existingData, newEntry];
    } else updatedData = [newEntry];

    safeSetJson("last_read", updatedData);

    // Now call backend (mutate). If it fails, rollback optimistic lesson-plan update.
    try {
      await progressMutation.mutateAsync(payload);
      toast({ title: "Progress saved!", description: `Marked complete: ${newEntry.subtopicTitle}` });
    } catch (err: any) {
      // rollback optimistic change if we have snapshot
      if (snapshot) {
        queryClient.setQueryData(lessonPlanKey, snapshot);
      }
      toast({
        title: "Failed to save progress",
        description: err instanceof Error ? err.message : "Could not save progress to server.",
        variant: "destructive",
      });
    }
  };

  const goToSubtopic = (idx: number) => {
    navigate(`/content/${chapterIdx}/${idx}`);
    setHasGenerated(null);
  };

  const handleNext = () => {
    if (currentIdx + 1 < totalSubtopics) goToSubtopic(currentIdx + 1);
    else navigate(`/content/${chapterIdx + 1}/0`);
  };

  const [assistantOpen, setAssistantOpen] = useState(false);
  const context = { studyId: studyID, chapterIdx, subtopicIdx: currentIdx };

  // quiz state: whether user has taken the quiz for this subtopic and whether passed
  const [quizTaken, setQuizTaken] = useState<boolean>(false);
  const [quizPassed, setQuizPassed] = useState<boolean>(false);
  const [quizLoading, setQuizLoading] = useState<boolean>(false);
  const hoverToastShownRef = useRef<boolean>(false);

  // fetch quiz status for current subtopic (non-blocking, best-effort)
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
        const resp = await quizStatusApi.get(studyID, chapterIdx, currentIdx).catch(() => ({ found: false, status: "From Frontend" }));
        console.log("Quiz status response:", resp);
        if (!mounted) return;
        if (resp && resp.found) {
          setQuizTaken(Boolean(resp.status.score !== null));
          setQuizPassed(Boolean(resp.status?.passed));
        } else {
          setQuizTaken(false);
          setQuizPassed(false);
        }
      } catch (e) {
        // ignore - keep defaults
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

  // Replace Mark Complete action: route user to subtopic quiz instead of immediately marking complete.
  const handleMarkCompleteClick = () => {
    if (!studyID) {
      toast({ title: "Missing study", description: "Cannot start quiz: missing study id", variant: "destructive" });
      return;
    }
    // navigate to assignment (subtopic) so server will mark completion only if user passes there
    try {
      enqueueNextForNavigation(); // optimistic fire-and-forget enqueue for next (idempotent)
    } catch (_) {}
    navigate(`/study/${studyID}/assignment/subtopic/${chapterIdx}/${currentIdx}`);
  };

  // Next button handlers: enforce quizTaken && quizPassed
  const onNextClickWhenLocked = () => {
    // keep toast as fallback for keyboard users who might attempt activation
    toast({ title: "Take quiz first", description: "Please take and pass the subtopic quiz before moving to next.", variant: "warning" });
  };

  // NEW: enqueue assignment generation only the first time user opens this subtopic
  useEffect(() => {
    if (!studyID) return;
    // only run for a subtopic page (content page shows subtopic index)
    const key = `assignment_generated:${studyID}:${chapterIdx}:${currentIdx}`;
    const already = localStorage.getItem(key);
    if (already) return;

    let mounted = true;
    (async () => {
      try {
        // Check whether assignment already exists (idempotent check)
        // assignmentApi.getSubtopicQuiz should return 200 if exists, 404/err if not
        const exists = await assignmentApi.getSubtopicQuiz(studyID, chapterIdx, currentIdx)
          .then(() => true)
          .catch((err: any) => {
            // treat 404 or other errors as "not exists" but avoid spamming logs
            return false;
          });

        if (!mounted) return;

        if (!exists) {
          // Fire-and-forget enqueue generation (server endpoint is idempotent)
          try {
            // Try to call assignment generation endpoint if available
            if (assignmentApi.generateSubtopic) {
              void assignmentApi.generateSubtopic(studyID, chapterIdx, currentIdx).catch(() => null);
            } else {
              // fallback direct fetch to known route
              void fetch(`/iiismart-assignment/subtopic/${encodeURIComponent(studyID)}/${chapterIdx}/${currentIdx}`, {
                method: "POST",
              }).catch(() => null);
            }
          } catch (_) {
            // ignore enqueue failure (non-blocking)
          }
        }

        // mark locally so we don't repeat checks in this browser
        localStorage.setItem(key, "1");
      } catch (_) {
        // ignore errors
      }
    })();

    return () => {
      mounted = false;
    };
  }, [studyID, chapterIdx, currentIdx]);

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
            <p className="text-muted-foreground mb-4">No content exists for this chapter yet.</p>
            <Button onClick={() => void enqueueAndPoll()}>
              Queue Generation
            </Button>
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className={Assistant_style.container}>
        <button
          onClick={() => setAssistantOpen(true)}
          style={{
            position: "fixed",
            right: 30,
            top: 600,
            zIndex: 80,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            padding: "8px 12px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          💬 AI Assistant
        </button>
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{currentTitle}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setFontSize(Math.max(12, fontSize - 2))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFontSize(Math.min(24, fontSize + 2))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card className="mb-6 p-8" style={{ fontSize: `${fontSize}px` }}>
            <MarkdownRenderer content={currentContent || "No content for this subtopic."} />
          </Card>

          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => {
                if (currentIdx > 0) goToSubtopic(currentIdx - 1);
                else if (chapterIdx > 0) navigate(`/content/${chapterIdx - 1}/0`);
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
                  } catch (_) {}
                  navigate(`/study/${studyID}/assignment/subtopic/${chapterIdx}/${currentIdx}`);
                }}
              >
                Take Quiz
              </Button>

              {/* Mark Complete now opens the quiz as requested */}
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
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  navigate(`/study/${studyID}/assignment/chapter/${chapterIdx}/0`);
                }}
              >
                Take Chapter Test
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              // Next button: disabled unless quizTaken && quizPassed
              <span title={!quizTaken ? "Please take the quiz first" : "You must pass the quiz to proceed"}>
                <Button
                  onClick={() => {
                    // Defensive: If user tries to click via keyboard/assistive tech, still guard
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

        <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} context={context} />
      </div>
    </div>
  );
};

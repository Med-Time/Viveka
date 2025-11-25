import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LessonPlanList } from "@/components/Plan/LessonPlanList";
// ADDED: Lock icon import
import { BookOpen, Lock } from "lucide-react"; 
import { lessonPlanApi } from "./lessonPlan.api";

import { queryKeys } from "@/api/queryKeys";
import { toast } from "@/hooks/use-toast";
import { safeGetJson } from "@/utils/storage";

export const LessonPlanPage = () => {
  const navigate = useNavigate();

  // prefer explicit study id in localStorage, fallback to user object
  const auth = safeGetJson("user") || {};
  const persisted = localStorage.getItem("current_study_id");
  const userStudies: { study_id?: string; subject?: string; created_at?: string }[] = auth?.studies || [];
  const validPersisted = persisted && userStudies.some((s) => s.study_id === persisted) ? persisted : null;
  const initialStudy = validPersisted || userStudies?.[0]?.study_id || auth?.current_study_id || null;

  const [currentStudyId, setCurrentStudyId] = useState<string | null>(initialStudy);
  const [showStudySelector, setShowStudySelector] = useState<boolean>(!Boolean(currentStudyId));
  const token = localStorage.getItem("auth_token") || "";

  useEffect(() => {
    setShowStudySelector(!Boolean(currentStudyId) && userStudies && userStudies.length > 0);
  }, [currentStudyId, userStudies]);

  const handleSelectStudy = (id: string) => {
    if (!id) return;
    localStorage.setItem("current_study_id", id);
    setCurrentStudyId(id);
    setShowStudySelector(false);
  };

  if (!currentStudyId) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
          <Card className="max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Select a study to view lesson plan</CardTitle>
            </CardHeader>
            <CardContent>
              {userStudies && userStudies.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {userStudies.map((s, i) => (
                    <div key={s.study_id || i} className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="font-medium">{s.subject || `Study ${i + 1}`}</div>
                        <div className="text-sm text-muted-foreground">
                          {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                      <Button onClick={() => handleSelectStudy(s.study_id || "")}>Select</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="mb-4 text-muted-foreground">No studies found. Start assessment or onboarding.</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => navigate("/onboarding")}>Onboarding</Button>
                    <Button variant="outline" onClick={() => navigate("/interview")}>Start Assessment</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const study_id = currentStudyId;
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // First: check whether a lesson plan already exists for this study.
  useEffect(() => {
    if (!study_id) return;
    let mounted = true;
    (async () => {
      try {
        await lessonPlanApi.get(study_id);
        if (mounted) setHasGenerated(true);
      } catch (err) {
        // If not found: enqueue generation silently and continue rendering
        if (mounted) setHasGenerated(false);
        try {
          const res = await lessonPlanApi.enqueue(study_id);
          const jobId = res.job_id;
          toast({ title: "Lesson plan queued", description: "Generating your lesson plan in background." });

          // poll job status in background
          (async function poll() {
            for (let i = 0; i < 60; i++) {
              try {
                const job = await lessonPlanApi.getJob(jobId);
                if (job && job.status === "ready") {
                  if (mounted) setHasGenerated(true);
                  // invalidate and let react-query re-fetch
                  queryClient.invalidateQueries(queryKeys.lessonPlan.get(study_id));
                  toast({ title: "Lesson plan ready", description: "Your personalized plan is available." });
                  break;
                }
                if (job && job.status === "failed") {
                  toast({ title: "Generation failed", description: job.error || "See server logs.", variant: "destructive" });
                  break;
                }
              } catch (_) {
                // ignore
              }
              await new Promise((r) => setTimeout(r, 3000));
            }
          })();
        } catch (e) {
          // ignore enqueue errors for now
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [study_id]);

  const queryClient = useQueryClient();

  const { data: lessonPlan, isLoading, refetch } = useQuery({
    queryKey: queryKeys.lessonPlan.get(study_id),
    queryFn: () => lessonPlanApi.get(study_id),
    enabled: hasGenerated && !!study_id,
  });

  const generateMutation = useMutation({
    mutationFn: () => lessonPlanApi.generate(study_id),
    onMutate: async () => {
      setIsGenerating(true);
      setHasGenerated(true);
    },
    onSuccess: async () => {
      setIsGenerating(false);
      toast({
        title: "Lesson plan generated",
        description: "Fetching your personalized plan...",
      });
      setTimeout(() => {
        refetch();
      }, 1000);
    },
    onError: (err: any) => {
      setIsGenerating(false);
      setHasGenerated(false);
      toast({
        title: "Failed to generate lesson plan",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGeneratePlan = () => {
    if (!study_id) {
      toast({ title: "Error", description: "Missing study id", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setHasGenerated(true);
    generateMutation.mutate();
  };

  const handleStartChapter = (chapterIdx: number) => {
    if (!lessonPlan) {
      navigate(`/content/${chapterIdx}/0`);
      return;
    }

    const chapters = lessonPlan.lesson_plan?.chapters || [];
    const chapter = chapters[chapterIdx];

    if (!chapter || !Array.isArray(chapter.sub_topics) || chapter.sub_topics.length === 0) {
      navigate(`/content/${chapterIdx}/0`);
      return;
    }

    const firstUncompleted = chapter.sub_topics.findIndex((st: any) => !Boolean(st.completed));
    const targetSubtopicIdx = firstUncompleted === -1 ? chapter.sub_topics.length - 1 : firstUncompleted;

    if (!localStorage.getItem("current_study_id") && currentStudyId) {
      localStorage.setItem("current_study_id", currentStudyId);
    }

    navigate(`/content/${chapterIdx}/${targetSubtopicIdx}`);
  };

  if ((!hasGenerated && !isLoading) || isGenerating || (hasGenerated && !lessonPlan)) {
    if (!hasGenerated && !isLoading && !isGenerating) {
      return (
        <div className="min-h-screen bg-background">
          <AppHeader />
          <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
            <Card className="max-w-md text-center">
              <CardHeader>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Generate Your Lesson Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-6 text-muted-foreground">
                  Based on your learning profile and goals, we'll create a personalized curriculum just for you.
                </p>
                <Button
                  size="lg"
                  onClick={handleGeneratePlan}
                  disabled={generateMutation.isPending || isGenerating}
                  className="w-full"
                >
                  {generateMutation.isPending || isGenerating ? "Generating..." : "Generate Lesson Plan"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
          <Card className="max-w-lg text-center p-8">
            <div className="mb-4">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <h3 className="text-lg font-semibold">Generating your lesson plan…</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This can take a minute — we'll let you know when it's ready.
              </p>
            </div>
            <div className="flex gap-2 justify-center mt-4">
              <Button disabled>Generating...</Button>
              <Button variant="outline" onClick={() => navigate("/")}>
                Back to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // --- NEW LOGIC: Check if ALL chapters and subtopics are completed ---
  const isCourseComplete = lessonPlan.lesson_plan.chapters.every((chapter: any) => 
    chapter.sub_topics?.every((st: any) => Boolean(st.completed))
  );
  // ------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">{lessonPlan.lesson_plan.subject_name}</h1>
          <p className="text-muted-foreground">
            {lessonPlan.lesson_plan.overall_course_outcome}
          </p>
        </div>

        <LessonPlanList items={lessonPlan.lesson_plan.chapters} onStartChapter={handleStartChapter} />

        {/* --- UPDATED CAPSTONE PROJECT BUTTON SECTION --- */}
        <div className={`mt-12 p-8 border rounded-lg text-center transition-all duration-200 ${isCourseComplete ? "bg-muted/30" : "bg-muted/10 opacity-75"}`}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <h2 className="text-2xl font-bold">
              {isCourseComplete ? "🎉 Course Completion" : "🔒 Capstone Project Locked"}
            </h2>
          </div>
          
          <p className="text-muted-foreground mb-6">
            {isCourseComplete 
              ? "Ready to prove your mastery? Take the final comprehensive capstone project."
              : "Complete all chapters and subtopics above to unlock the final Capstone Project."}
          </p>

          <Button 
            size="lg" 
            disabled={!isCourseComplete}
            className={`w-full md:w-auto ${isCourseComplete ? "bg-purple-600 hover:bg-purple-700" : ""}`}
            onClick={() => {
              if (!isCourseComplete) return;
              // Navigate to Subject Assignment
              navigate(`/study/${study_id}/assignment/subject/0/0`);
            }}
          >
            {!isCourseComplete && <Lock className="mr-2 h-4 w-4" />}
            Start Capstone Project
          </Button>
        </div>
        {/* ----------------------------------- */}

      </div>
    </div>
  );
};
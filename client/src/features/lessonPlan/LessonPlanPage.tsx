import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LessonPlanList } from "@/components/Plan/LessonPlanList";
import { BookOpen } from "lucide-react";
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
  // If it exists, enable the react-query fetch (setHasGenerated(true)) so the main query runs.
  useEffect(() => {
    if (!study_id) return;
    let mounted = true;
    (async () => {
      try {
        // Try to fetch the lesson plan; if it exists, enable main query
        await lessonPlanApi.get(study_id);
        if (mounted) setHasGenerated(true);
      } catch (err) {
        // If not found or error, we keep hasGenerated=false so UI shows generate button
      }
    })();
    return () => {
      mounted = false;
    };
  }, [study_id]);

  const { data: lessonPlan, isLoading, refetch } = useQuery({
    queryKey: queryKeys.lessonPlan.get(study_id),
    queryFn: () => lessonPlanApi.get(study_id),
    enabled: hasGenerated && !!study_id,
  });

  // --- generateMutation with onMutate + onSuccess + onError (updated per patch) ---
  const generateMutation = useMutation({
    mutationFn: () => lessonPlanApi.generate(study_id),
    // run before the mutation request is sent
    onMutate: async () => {
      setIsGenerating(true);      // show generating UI immediately
      setHasGenerated(true);      // enable "generated" flow UI
    },
    onSuccess: async () => {
      // generation finished on server — refresh the lesson plan
      setIsGenerating(false);
      toast({
        title: "Lesson plan generated",
        description: "Fetching your personalized plan...",
      });
      // refetch the plan; allow a small delay so backend can finish DB writes
      setTimeout(() => {
        refetch();
      }, 1000);
    },
    onError: (err: any) => {
      setIsGenerating(false);
      // mark as not generated so user can try again
      setHasGenerated(false);
      toast({
        title: "Failed to generate lesson plan",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // --- handle to start generation (call from UI) ---
  const handleGeneratePlan = () => {
    if (!study_id) {
      toast({ title: "Error", description: "Missing study id", variant: "destructive" });
      return;
    }
    // mark as started immediately (onMutate does this too, but double-safety)
    setIsGenerating(true);
    setHasGenerated(true);
    generateMutation.mutate();
  };

  const handleStartChapter = (chapterIdx: number) => {
    if (!lessonPlan) {
      // fallback: go to chapter root
      navigate(`/content/${chapterIdx}/0`);
      return;
    }

    const chapters = lessonPlan.lesson_plan?.chapters || [];
    const chapter = chapters[chapterIdx];

    if (!chapter || !Array.isArray(chapter.sub_topics) || chapter.sub_topics.length === 0) {
      // no subtopics — go to chapter 0
      navigate(`/content/${chapterIdx}/0`);
      return;
    }

    // Find index of first subtopic that is NOT completed
    const firstUncompleted = chapter.sub_topics.findIndex((st: any) => !Boolean(st.completed));

    // If none uncompleted, go to last subtopic; otherwise go to first uncompleted
    const targetSubtopicIdx = firstUncompleted === -1 ? chapter.sub_topics.length - 1 : firstUncompleted;

    // Persist current study id if not already
    if (!localStorage.getItem("current_study_id") && currentStudyId) {
      localStorage.setItem("current_study_id", currentStudyId);
    }

    navigate(`/content/${chapterIdx}/${targetSubtopicIdx}`);
  };

  // --- UI: show generating screen while generation is happening or plan not yet available ---
  // Replaces previous separate `if (!hasGenerated && !isLoading)` / `if (isGenerating || isLoading)` / `if (!lessonPlan)` blocks
  if ((!hasGenerated && !isLoading) || isGenerating || (hasGenerated && !lessonPlan)) {
    // Two main cases:
    // 1) Not generated yet and not loading => show "generate" CTA
    // 2) Generation started (isGenerating === true) OR hasGenerated true but lessonPlan not yet available => show "generating" UI
    if (!hasGenerated && !isLoading && !isGenerating) {
      // original "Generate your lesson plan" CTA
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

    // Generating placeholder while backend is working
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

            <div className="flex gap-2justify-center mt-4">
              <Button onClick={() => { /* optional: cancel flow if you support cancellation */ }} disabled>
                Generating...
              </Button>
              <Button variant="outline" onClick={() => {
                // allow user to go back to dashboard while generation continues in background
                navigate("/");
              }}>
                Back to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // --- rest of page follows: when lessonPlan exists you render it as before ---
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
      </div>
    </div>
  );
};

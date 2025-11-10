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

  const sessionId = currentStudyId;
  console.log("User study id:", sessionId);
  console.log("Token:", token);

  const [hasGenerated, setHasGenerated] = useState(false);

  // First: check whether a lesson plan already exists for this study.
  // If it exists, enable the react-query fetch (setHasGenerated(true)) so the main query runs.
  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;
    (async () => {
      try {
        // Try to fetch the lesson plan; if it exists, enable main query
        await lessonPlanApi.get(sessionId);
        if (mounted) setHasGenerated(true);
      } catch (err) {
        // If not found or error, we keep hasGenerated=false so UI shows generate button
        console.log("No existing lesson plan for study:", sessionId);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const { data: lessonPlan, isLoading, refetch } = useQuery({
    queryKey: queryKeys.lessonPlan.get(sessionId),
    queryFn: () => lessonPlanApi.get(sessionId),
    enabled: hasGenerated && !!sessionId,
  });

  const generateMutation = useMutation({
    mutationFn: () => lessonPlanApi.generate(sessionId),
    onSuccess: () => {
      console.log("Lesson plan generation started");
      setHasGenerated(true);
      toast({
        title: "Generating your lesson plan",
        description: "This may take a moment...",
      });
      setTimeout(() => {
        refetch();
      }, 2000);
    },
  });

  const handleGeneratePlan = () => {
    generateMutation.mutate();
  };

  const handleStartChapter = (chapterIdx: number) => {
    navigate(`/content/${chapterIdx}`);
  };

  if (!hasGenerated && !isLoading) {
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
                disabled={generateMutation.isPending}
                className="w-full"
              >
                {generateMutation.isPending ? "Generating..." : "Generate Lesson Plan"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Creating your personalized lesson plan...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!lessonPlan) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No lesson plan available.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">{lessonPlan.lesson_plan.subject_name}</h1>
          <p className="text-muted-foreground">
            Your personalized learning path with {lessonPlan.lesson_plan.chapters.length} chapters
          </p>
        </div>

        <LessonPlanList items={lessonPlan.lesson_plan.chapters} onStartChapter={handleStartChapter} />
      </div>
    </div>
  );
};

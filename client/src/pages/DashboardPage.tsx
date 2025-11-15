import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Target, Play } from "lucide-react";
import { safeGetJson } from "@/utils/storage";
// ⬇️ shadcn select
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export const DashboardPage = () => {
  const navigate = useNavigate();
  const storedUser = safeGetJson("user") || {};
  const persistedStudyId = localStorage.getItem("current_study_id");

  const userStudies: { study_id?: string; subject?: string; created_at?: string }[] =
    storedUser?.studies || [];

  // Helper: get most recent study_id from last_read array (last element considered most recent)
  const getMostRecentLastReadStudyId = (): string | null => {
    const allLastReads = safeGetJson("last_read");
    if (Array.isArray(allLastReads) && allLastReads.length > 0) {
      const last = allLastReads[allLastReads.length - 1];
      return last?.study_id || null;
    }
    // If old single-object format
    if (allLastReads && typeof allLastReads === "object" && allLastReads.study_id) {
      return allLastReads.study_id;
    }
    return null;
  };

  // validate persisted study id against user's studies
  const validPersisted =
    persistedStudyId && userStudies.some((s) => s.study_id === persistedStudyId)
      ? persistedStudyId
      : null;

  // Determine default study id priority:
  // 1) valid persisted, 2) first userStudies entry, 3) most recent last_read study, 4) storedUser.current_study_id, 5) ""
  const mostRecentFromLastRead = getMostRecentLastReadStudyId();
  const defaultStudyId =
    validPersisted ||
    (userStudies?.[0]?.study_id || null) ||
    mostRecentFromLastRead ||
    storedUser?.current_study_id ||
    "";

  const [currentStudyId, setCurrentStudyId] = useState<string>(defaultStudyId);
  const [showStudySelector, setShowStudySelector] = useState<boolean>(false);

  // show selector when user has multiple studies and none selected
  useEffect(() => {
    if (!currentStudyId && userStudies && userStudies.length > 1) {
      setShowStudySelector(true);
    } else {
      setShowStudySelector(false);
    }
  }, [currentStudyId, userStudies]);

  // read last-read location if present and find matching entry for currentStudyId
  const allLastReads = safeGetJson("last_read") || [];
  const currentLastRead =
    Array.isArray(allLastReads)
      ? allLastReads.find((item) => item.study_id === currentStudyId) || null
      : allLastReads && allLastReads.study_id === currentStudyId
      ? allLastReads
      : null;

  const canContinue = Boolean(currentLastRead && currentStudyId);

  const handleSelectStudy = (studyId: string) => {
    if (!studyId) return;
    localStorage.setItem("current_study_id", studyId);
    setCurrentStudyId(studyId);
    setShowStudySelector(false);
  };

  const hasMultipleSubjects = (userStudies || []).length > 1;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-8">
        {/* Header row with right-side Subject switcher */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Welcome to Your Dashboard</h1>
            <p className="text-muted-foreground">Continue your personalized learning journey</p>
          </div>

          {hasMultipleSubjects && (
            <div className="min-w-[240px]">
              <Select
                value={currentStudyId || undefined}
                onValueChange={(v) => handleSelectStudy(v)}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {userStudies.map((s, i) => (
                    <SelectItem key={s.study_id || String(i)} value={s.study_id || ""}>
                      {s.subject || `Study ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-1 text-right text-xs text-muted-foreground">
                Switch subject
              </div>
            </div>
          )}
        </div>

        {/* If user has multiple studies and no current selected, prompt selection */}
        {showStudySelector && (
          <Card className="mb-6 border-primary/10">
            <CardHeader>
              <CardTitle>Select a study</CardTitle>
              <CardDescription>Choose which subject you want to continue with</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {userStudies.map((s, i) => (
                  <div key={s.study_id || i} className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{s.subject || `Study ${i + 1}`}</div>
                      <div className="text-sm text-muted-foreground">
                        {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
                      </div>
                    </div>
                    <div>
                      <Button onClick={() => handleSelectStudy(s.study_id || "")}>Select</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Start a new course (onboarding) */}
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Start a New Course</CardTitle>
              <CardDescription>Create a course and set your learning preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/onboarding")} className="w-full gap-2">
                <Play className="h-4 w-4" />
                Create Course
              </Button>
            </CardContent>
          </Card>

          {/* Removed direct "Start Assessment" action — replaced with access to View Profile / Lesson Plan */}
          {currentStudyId && (
            <>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <BookOpen className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle>View Your Profile</CardTitle>
                  <CardDescription>See your learning persona and recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => navigate("/persona")}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <Play className="h-4 w-4" />
                    View Profile
                  </Button>
                </CardContent>
              </Card>

              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Lesson Plan</CardTitle>
                  <CardDescription>Access your personalized learning curriculum</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => {
                      if (!localStorage.getItem("current_study_id")) {
                        localStorage.setItem("current_study_id", currentStudyId);
                      }
                      navigate("/lesson-plan");
                    }}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <Play className="h-4 w-4" />
                    View Plan
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {/* Continue Reading card */}
          {canContinue && currentLastRead && (
            <Card className="transition-shadow hover:shadow-md col-span-full md:col-span-1">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <BookOpen className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Continue Reading</CardTitle>
                <CardDescription>Continue where you left off</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-2 text-sm text-muted-foreground">
                  {currentLastRead.chapterTitle
                    ? `${currentLastRead.chapterTitle} — ${currentLastRead.subtopicTitle || ""}`
                    : `Chapter ${currentLastRead.chapterIdx ?? 0} — Subtopic ${((currentLastRead.subtopicIdx ?? 0) + 1)}`}
                </div>
                <Button
                  onClick={() => navigate(`/content/${currentLastRead.chapterIdx}/${currentLastRead.subtopicIdx}`)}
                  variant="outline"
                  className="w-full gap-2"
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {!currentStudyId && (
          <Card className="mt-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Create a course to begin your personalized learning experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/onboarding")} size="lg">
                Start Now
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

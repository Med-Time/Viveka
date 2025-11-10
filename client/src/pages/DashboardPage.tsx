import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, Target, Play } from "lucide-react";
import { safeGetJson } from "@/utils/storage";

export const DashboardPage = () => {
  const navigate = useNavigate();
  const storedUser = safeGetJson("user") || {};
  const persistedStudyId = localStorage.getItem("current_study_id");
  const userStudies: { study_id?: string; subject?: string; created_at?: string }[] = storedUser?.studies || [];
  // prefer a validated persisted id (must belong to user's studies); else use first study id if available
  console.log("DashboardPage: userStudies =", userStudies);
  const validPersisted =
    persistedStudyId && userStudies.some((s) => s.study_id === persistedStudyId) ? persistedStudyId : null;
  const defaultStudyId = userStudies?.[0]?.study_id || storedUser?.current_study_id || "";

  const [currentStudyId, setCurrentStudyId] = useState<string>(validPersisted || defaultStudyId);
  const [showStudySelector, setShowStudySelector] = useState<boolean>(false);

  // show selector when user has multiple studies and none selected
  useEffect(() => {
    if (!currentStudyId && userStudies && userStudies.length > 1) {
      setShowStudySelector(true);
    } else {
      setShowStudySelector(false);
    }
  }, [currentStudyId, userStudies]);

  // read last-read location if present
  let lastRead = null;
  try {
    lastRead = JSON.parse(localStorage.getItem("last_read") || "null");
  } catch {
    lastRead = null;
  }

  const canContinue =
    lastRead && lastRead.study_id && currentStudyId && lastRead.study_id === currentStudyId;

  const handleSelectStudy = (studyId: string) => {
    if (!studyId) return;
    localStorage.setItem("current_study_id", studyId);
    // do NOT write user id or "session_id" here — keep only current_study_id
    setCurrentStudyId(studyId);
    setShowStudySelector(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Welcome to Your Dashboard</h1>
          <p className="text-muted-foreground">Continue your personalized learning journey</p>
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
                  console.log("DashboardPage: rendering study", s),
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
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Start Onboarding</CardTitle>
              <CardDescription>Tell us about your learning goals and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/onboarding")} className="w-full gap-2">
                <Play className="h-4 w-4" />
                Begin Setup
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                <Brain className="h-6 w-6 text-secondary" />
              </div>
              <CardTitle>Take Assessment</CardTitle>
              <CardDescription>
                Complete our adaptive assessment to personalize your learning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/interview")} className="w-full gap-2">
                <Play className="h-4 w-4" />
                Start Assessment
              </Button>
            </CardContent>
          </Card>

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
                  <Button onClick={() => navigate("/persona")} variant="outline" className="w-full gap-2">
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
                      // ensure current study saved before navigating
                      if (!localStorage.getItem("current_study_id")) {
                        localStorage.setItem("current_study_id", currentStudyId);
                        localStorage.setItem("study_id", currentStudyId);
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
          {canContinue && (
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
                  {lastRead.chapterTitle ? lastRead.chapterTitle : `Chapter ${lastRead.chapterIdx}`}
                  {lastRead.subtopicTitle ? ` — ${lastRead.subtopicTitle}` : ` — Subtopic ${lastRead.subtopicIdx + 1}`}
                </div>
                <Button
                  onClick={() => navigate(`/content/${lastRead.chapterIdx}/${lastRead.subtopicIdx}`)}
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
                Complete the onboarding and assessment to unlock your personalized learning experience
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

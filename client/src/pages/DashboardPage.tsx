import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, Target, Play } from "lucide-react";
import { safeGetJson } from "@/utils/storage";

export const DashboardPage = () => {
  const navigate = useNavigate();
  const storedUser = safeGetJson("user");
  const sessionId =
    storedUser?.id || storedUser?.user?.id || localStorage.getItem("id") || "";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Welcome to Your Dashboard</h1>
          <p className="text-muted-foreground">
            Continue your personalized learning journey
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Start Onboarding</CardTitle>
              <CardDescription>
                Tell us about your learning goals and preferences
              </CardDescription>
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

          {sessionId && (
            <>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <BookOpen className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle>View Your Profile</CardTitle>
                  <CardDescription>
                    See your learning persona and recommendations
                  </CardDescription>
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
                  <CardDescription>
                    Access your personalized learning curriculum
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => navigate("/lesson-plan")} variant="outline" className="w-full gap-2">
                    <Play className="h-4 w-4" />
                    View Plan
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {!sessionId && (
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

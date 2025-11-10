import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { personaApi } from "./persona.api";
import { queryKeys } from "@/api/queryKeys";

export const PersonaPage = () => {
  const navigate = useNavigate();
  const sessionId = localStorage.getItem("study_id") || "";

  const { data: persona, isLoading } = useQuery({
    queryKey: queryKeys.persona(sessionId),
    queryFn: () => personaApi.get(sessionId),
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Analyzing your learning profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!persona) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No persona data available.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 text-3xl font-bold">Your Learning Profile</h1>
          <p className="text-muted-foreground">
            Based on your assessment, we've created a personalized learning plan
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">{persona.summary}</p>
            {persona.recommended_level && (
              <div className="mt-4">
                <Badge variant="secondary" className="text-sm">
                  Recommended Level: {persona.recommended_level}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Learning Traits</CardTitle>
            <CardDescription>
              Key characteristics that define your learning style
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {persona.traits.map((trait, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-muted/50 p-4"
                >
                  <h3 className="mb-1 font-semibold">{trait.key}</h3>
                  <p className="text-sm text-muted-foreground">{trait.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button size="lg" onClick={() => navigate("/lesson-plan")}>
            Generate My Lesson Plan
          </Button>
        </div>
      </div>
    </div>
  );
};

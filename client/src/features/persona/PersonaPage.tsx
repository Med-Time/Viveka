import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { personaApi } from "./persona.api";
import { queryKeys } from "@/api/queryKeys";

export const PersonaPage = () => {
  const navigate = useNavigate();
  const studyId = localStorage.getItem("current_study_id") || "";

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.persona(studyId),
    queryFn: () => personaApi.get(studyId),
    enabled: !!studyId,
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

  if (!data) {
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

  const persona = data;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 text-3xl font-bold">Your Learning Persona</h1>
          <p className="text-muted-foreground">
            A personalized overview of your learning profile based on your assessment
          </p>
        </div>

        {/* Profile Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Summary</CardTitle>
            <CardDescription>
              A concise summary of your learning characteristics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">{persona.learner_profile_summary}</p>
          </CardContent>
        </Card>

        {/* Learning Style Assessment */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Learning Style Assessment</CardTitle>
            <CardDescription>Your preferred learning approaches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {persona.learning_style_assessment.map((style, idx) => (
                <Badge key={idx} variant="secondary">
                  {style}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Strengths */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 space-y-1">
              {persona.strengths.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Weaknesses & Gaps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Weaknesses and Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 space-y-1">
              {persona.weaknesses_and_gaps.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Common Misconceptions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Common Misconceptions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 space-y-1">
              {persona.common_misconceptions.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Engagement & Confidence */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Engagement & Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{persona.engagement_and_confidence}</p>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Actionable Learning Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 space-y-1">
              {persona.actionable_learning_recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Roadmap Suggestions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Preliminary Personalized Roadmap Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 space-y-1">
              {persona.preliminary_personalized_roadmap_suggestions.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button size="lg" onClick={() => navigate("/lesson-plan")}>
            Continue to Lesson Plan
          </Button>
        </div>
      </div>
    </div>
  );
};

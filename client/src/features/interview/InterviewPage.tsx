import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { OpenQuestion } from "@/components/Question/OpenQuestion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import { interviewApi } from "./interview.api";
import {
  StartInterviewResponse,
  AnswerInterviewResponse,
  QuestionType,
} from "@/types/api";
import { safeGetJson } from "@/utils/storage";
import { toast } from "@/hooks/use-toast";

type LocationState = {
  start: StartInterviewResponse;
};

export const InterviewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Expect the onboarding page to pass this:
  // navigate("/interview", { state: { start: startResponse } })
  const startFromState = (location.state as LocationState | null)?.start || null;

  // If user directly lands on this page (no state), ask them to start onboarding
  if (!startFromState) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="p-6 text-center space-y-4">
            <p className="text-muted-foreground">
              You haven’t started an assessment yet.
            </p>
            <Button onClick={() => navigate("/onboarding")}>Start Assessment</Button>
          </Card>
        </div>
      </div>
    );
  }

  const [current, setCurrent] = useState<StartInterviewResponse>(startFromState);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [score, setScore] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const storedUser = safeGetJson("user");
  const userId =
    storedUser?.id || storedUser?.user?.id || localStorage.getItem("id") || "";

  const answerMutation = useMutation<
    AnswerInterviewResponse,
    unknown,
    { answer: string }
  >({
    mutationFn: ({ answer }) => {
      if (!userId) {
        return Promise.reject(new Error("Missing user_id"));
      }
      // API requires only { user_id, answer }
      return interviewApi.answer({
        user_id: userId,
        answer,
      });
    },
    onSuccess: (data) => {
      setScore(typeof data.score === "number" ? data.score : null);
      setShowResult(true);

      // Backend returns the next question in data.question (type: StartInterviewResponse)
      // We won’t immediately switch — we show a Continue button.
      if (!data.question) {
        toast({
          title: "Answer recorded",
          description: "Proceed when ready.",
        });
      }
    },
    onError: (err) => {
      toast({
        title: "Could not submit answer",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitAnswer = (answer: string | string[]) => {
    const answerValue = Array.isArray(answer) ? answer.join(", ") : answer;
    setShowResult(false);
    setScore(null);
    answerMutation.mutate({ answer: answerValue });
  };

  const handleContinue = () => {
    const next = answerMutation.data?.question;
    if (next) {
      setCurrent(next);
      setQuestionNumber((n) => n + 1);
      setShowResult(false);
      setScore(null);
    } else {
      // If backend eventually ends the flow (not in types), send user to persona
      navigate("/persona");
    }
  };

  const qType: QuestionType = current.type;
  const prompt = current.question; // string per API
  const concept = current.concept; // optional hint
  const studyId = current.study_id;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Assessment</h1>
          <p className="text-muted-foreground">
            Answer each question to help us understand your learning style
          </p>
        </div>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className="text-muted-foreground">Question {questionNumber}</span>
          </div>
          <Progress value={questionNumber * 10} className="h-2" />
        </div>

        {/* Result / score card */}
        {showResult && (
          <Card className="mb-6 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5" />
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-semibold">Answer submitted</span>
                  {typeof score === "number" && (
                    <Badge variant="secondary">{Math.round(score * 100)}%</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {typeof score === "number"
                    ? "Score reflects how well your answer matched the expected response."
                    : "Your response has been recorded."}
                </p>
              </div>
            </div>

            {answerMutation.data?.question && (
              <Button onClick={handleContinue} className="mt-4 w-full">
                Continue to Next Question
              </Button>
            )}
          </Card>
        )}

        {/* Question */}
        {!showResult && (
          <>
            {/* Your API doesn’t provide MCQ options or blanks in the type definitions,
                so we use OpenQuestion for all types. */}
            <OpenQuestion
              id={`${studyId}-${questionNumber}`}
              prompt={prompt}
              questionNumber={questionNumber}
              onSubmit={handleSubmitAnswer}
              disabled={answerMutation.isPending}
              hint={concept}
            />
          </>
        )}
      </div>
    </div>
  );
};

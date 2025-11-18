import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { OpenQuestion } from "@/components/Question/OpenQuestion";
import { FillBlanksQuestion } from "@/components/Question/FillBlanksQuestion";
import { McqQuestion } from "@/components/Question/McqQuestion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import { interviewApi } from "./interview.api";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  StartInterviewResponse,
  AnswerInterviewResponse,
  QuestionType,
} from "@/types/api";
import { safeGetJson } from "@/utils/storage";
import { toast } from "@/hooks/use-toast";
import { extractOptions } from "@/lib/utils";

type LocationState = {
  start: StartInterviewResponse;
};

export const InterviewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // may be passed from onboarding: navigate("/interview", { state: { start } })
  const startFromState = (location.state as LocationState | null)?.start || null;

  // If user directly lands here without starting onboarding, show call-to-action
  if (!startFromState) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="p-6 text-center space-y-4">
            <p className="text-muted-foreground">You haven't started an assessment yet.</p>
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
  const [feedback, setFeedback] = useState<string | null>(null);

  const storedUser = safeGetJson("user");
  const userId =
    storedUser?.id || storedUser?.user?.id || localStorage.getItem("id") || "";

  const answerMutation = useMutation<AnswerInterviewResponse, unknown, { answer: string }>(
    {
      mutationFn: ({ answer }) => {
        if (!userId) {
          return Promise.reject(new Error("Missing user_id"));
        }
        return interviewApi.answer({
          user_id: userId,
          answer,
        });
      },
      onSuccess: (data) => {
        // If backend indicates flow finished
        if (data.status === "done") {
          const final = typeof data.final_score === "number" ? data.final_score : null;
          setScore(final);
          setFeedback(data.feedback ?? null);
          setShowResult(true);

          toast({
            title: "Assessment complete",
            description: "Generating your persona report.",
          });

          // Save study_id if backend returned one and navigate to persona page
          if (data.study_id) localStorage.setItem("current_study_id", data.study_id);
          
          navigate("/persona");
          return;
        }

        // In-flow response
        setScore(typeof data.score === "number" ? data.score : null);
        setFeedback(data.feedback ?? null);
        setShowResult(true);

        // store study_id if present
        if (data.study_id) {
          localStorage.setItem("current_study_id", data.study_id);
        }

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
    }
  );

  const handleSubmitAnswer = (answer: string | string[]) => {
    const answerValue = Array.isArray(answer) ? answer.join(", ") : answer;
    setShowResult(false);
    setScore(null);
    setFeedback(null);
    answerMutation.mutate({ answer: answerValue });
  };

  const handleContinue = () => {
    const next = answerMutation.data?.question;
    if (next) {
      // next is a string (question) plus metadata in other fields — build a new StartInterviewResponse-like object
      const nextObj: StartInterviewResponse = {
        status: "ok",
        study_id: answerMutation.data?.study_id || current.study_id,
        type: (answerMutation.data?.type as QuestionType) || current.type,
        question: answerMutation.data?.question || "",
        concept: answerMutation.data?.concept || undefined,
      };

      setCurrent(nextObj);
      setQuestionNumber((n) => n + 1);
      setShowResult(false);
      setScore(null);
      setFeedback(null);

      if (nextObj.study_id) {
        localStorage.setItem("current_study_id", nextObj.study_id);
      }
    } else {
      // No next question returned — route to persona (or fallback)
      navigate("/persona");
    }
  };

  const qType: QuestionType = current.type as QuestionType;
  const prompt = current.question; // string per backend
  const concept = current.concept; // optional hint
  const studyId = current.study_id;
  let options: string[] = [];

  if (qType === "mcq") {
    options = Array.isArray((current as any).options)
      ? current.options
      : extractOptions(prompt);
  }

  // Utility to render score as percentage regardless of backend format
  const formatScorePercent = (s: number | null) => {
    if (s === null || s === undefined) return null;
    // If between 0 and 1 treat as fraction
    if (s >= 0 && s <= 1) return Math.round(s * 100);
    return Math.round(s);
  };

  const percent = formatScorePercent(score);

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
          <Progress value={Math.min(questionNumber * 10, 100)} className="h-2" />
        </div>

        {/* Result / score card */}
        {showResult && (
          <Card className="mb-6 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5" />
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-semibold">Answer submitted</span>
                  {percent !== null && (
                    <Badge variant="secondary">{percent}%</Badge>
                  )}
                </div>

                {feedback && feedback.length > 0 ? (
                  <div className="text-sm text-muted-foreground space-y-2">
                    <MarkdownRenderer content={feedback || "No feedback for this Question."} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {percent !== null
                      ? "Score reflects how well your answer matched the expected response."
                      : "Your response has been recorded."}
                  </p>
                )}
              </div>
            </div>

            {answerMutation.data?.question ? (
              <Button onClick={handleContinue} className="mt-4 w-full">
                Continue to Next Question
              </Button>
            ) : (
              <Button
                onClick={() => {
                  navigate("/persona");
                }}
                className="mt-4 w-full"
              >
                View Persona Report
              </Button>
            )}
          </Card>
        )}

    {/* Question */}
    {!showResult && (
      <>
      {qType === "mcq" && Array.isArray((current as any).options) ? (
              <McqQuestion
                id={`${studyId}-${questionNumber}`}
                prompt={prompt}
                options={options}
                questionNumber={questionNumber}
                onSubmit={handleSubmitAnswer}
                disabled={answerMutation.isPending}
              />
            ) : qType === "fill_in_the_blanks" ? (
          <FillBlanksQuestion
            id={`${studyId}-${questionNumber}`}
            prompt={prompt}
            // prefer explicit blanks count from backend; fallback to 1 if missing or invalid
            blanks={typeof (current as any).blanks === "number" && (current as any).blanks > 0 ? (current as any).blanks : 1}
            questionNumber={questionNumber}
            onSubmit={(answers: string[]) => handleSubmitAnswer(answers)}
            disabled={answerMutation.isPending}
          />
        ) : (
          //detailed / one word / etc. we render the OpenQuestion (text area)
          <OpenQuestion
            id={`${studyId}-${questionNumber}`}
            prompt={prompt}
            questionNumber={questionNumber}
            onSubmit={handleSubmitAnswer}
            disabled={answerMutation.isPending}
            hint={concept}
          />
        )}
      </>
    )}

      </div>
    </div>
  );
};

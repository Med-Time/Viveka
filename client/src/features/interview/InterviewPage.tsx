import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { McqQuestion } from "@/components/Question/McqQuestion";
import { OpenQuestion } from "@/components/Question/OpenQuestion";
import { FillBlanksQuestion } from "@/components/Question/FillBlanksQuestion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { interviewApi } from "./interview.api";
import { StartInterviewResponse, AnswerInterviewResponse } from "@/types/api";
import { toast } from "@/hooks/use-toast";

export const InterviewPage = () => {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string>("");
  const [currentQuestion, setCurrentQuestion] = useState<StartInterviewResponse["question"]>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [evaluation, setEvaluation] = useState<AnswerInterviewResponse["evaluation"] | null>(null);
  const [showEvaluation, setShowEvaluation] = useState(false);

  const { data: startData, isLoading: startLoading } = useQuery({
    queryKey: ["interview", "start"],
    queryFn: interviewApi.start,
  });

  useEffect(() => {
    if (startData) {
      setSessionId(startData.session_id);
      setCurrentQuestion(startData.question);
      localStorage.setItem("session_id", startData.session_id);
    }
  }, [startData]);

  const answerMutation = useMutation({
    mutationFn: interviewApi.answer,
    onSuccess: (data) => {
      setEvaluation(data.evaluation || null);
      setShowEvaluation(true);

      if (data.completed) {
        toast({
          title: "Assessment Complete!",
          description: "Let's see your personalized learning profile.",
        });
        setTimeout(() => {
          navigate("/persona");
        }, 2000);
      } else if (data.next_question) {
        // Will show Continue button
      }
    },
  });

  const handleSubmitAnswer = (answer: string | string[]) => {
    if (!currentQuestion || !sessionId) return;

    const answerValue = Array.isArray(answer) ? answer.join(", ") : answer;

    answerMutation.mutate({
      session_id: sessionId,
      question_id: currentQuestion.id,
      answer: answerValue,
    });
  };

  const handleContinue = () => {
    const nextQuestion = answerMutation.data?.next_question;
    if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      setQuestionNumber(questionNumber + 1);
      setShowEvaluation(false);
      setEvaluation(null);
    }
  };

  if (startLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Preparing your assessment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No questions available.</p>
          </Card>
        </div>
      </div>
    );
  }

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

        {showEvaluation && evaluation && (
          <Card className="mb-6 p-4">
            <div className="flex items-start gap-3">
              {evaluation.correctness === "correct" && (
                <CheckCircle className="h-5 w-5 text-success" />
              )}
              {evaluation.correctness === "partial" && (
                <AlertCircle className="h-5 w-5 text-accent" />
              )}
              {evaluation.correctness === "incorrect" && (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-semibold capitalize">{evaluation.correctness}</span>
                  {evaluation.score !== undefined && (
                    <Badge variant="secondary">
                      {Math.round(evaluation.score * 100)}%
                    </Badge>
                  )}
                </div>
                {evaluation.feedback && (
                  <p className="text-sm text-muted-foreground">{evaluation.feedback}</p>
                )}
              </div>
            </div>
            {answerMutation.data?.next_question && (
              <Button onClick={handleContinue} className="mt-4 w-full">
                Continue to Next Question
              </Button>
            )}
          </Card>
        )}

        {!showEvaluation && (
          <>
            {currentQuestion.type === "mcq" && currentQuestion.options && (
              <McqQuestion
                id={currentQuestion.id}
                prompt={currentQuestion.prompt}
                options={currentQuestion.options}
                questionNumber={questionNumber}
                onSubmit={handleSubmitAnswer}
                disabled={answerMutation.isPending}
              />
            )}
            {currentQuestion.type === "open" && (
              <OpenQuestion
                id={currentQuestion.id}
                prompt={currentQuestion.prompt}
                questionNumber={questionNumber}
                onSubmit={handleSubmitAnswer}
                disabled={answerMutation.isPending}
              />
            )}
            {currentQuestion.type === "fill" && currentQuestion.blanks && (
              <FillBlanksQuestion
                id={currentQuestion.id}
                prompt={currentQuestion.prompt}
                blanks={currentQuestion.blanks}
                questionNumber={questionNumber}
                onSubmit={(answers) => handleSubmitAnswer(answers)}
                disabled={answerMutation.isPending}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

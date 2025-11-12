import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { QuestionShell } from "./QuestionShell";

interface OpenQuestionProps {
  id: string;
  prompt: string;
  questionNumber?: number;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
  hint?: string;
}

export const OpenQuestion = ({
  id,
  prompt,
  questionNumber,
  onSubmit,
  disabled,
  hint,
}: OpenQuestionProps) => {
  const [answer, setAnswer] = useState("");
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  const handleSubmit = () => {
    if (answer.trim()) {
      onSubmit(answer);
    }
  };

  return (
    <QuestionShell type="detailed_answer" prompt={prompt} questionNumber={questionNumber}>
      <div className="space-y-4">
        {/* Render hint if provided */}
        {hint && (
          <div className="rounded-md border border-border bg-muted/5 p-3 text-sm text-muted-foreground">
            <strong className="mr-1">Hint:</strong>
            <span>{hint}</span>
          </div>
        )}

        <Textarea
          id={id}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer here..."
          disabled={disabled}
          rows={6}
          className="resize-none"
        />

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{wordCount} words</span>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!answer.trim() || disabled}
        className="mt-4 w-full"
      >
        Submit Answer
      </Button>
    </QuestionShell>
  );
};

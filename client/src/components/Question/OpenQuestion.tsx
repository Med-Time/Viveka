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
}

export const OpenQuestion = ({
  id,
  prompt,
  questionNumber,
  onSubmit,
  disabled,
}: OpenQuestionProps) => {
  const [answer, setAnswer] = useState("");
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  const handleSubmit = () => {
    if (answer.trim()) {
      onSubmit(answer);
    }
  };

  return (
    <QuestionShell type="open" prompt={prompt} questionNumber={questionNumber}>
      <div className="space-y-4">
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

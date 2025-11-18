import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuestionShell } from "./QuestionShell";
import { SpeechTextarea } from "./SpeechTextarea";

interface OpenQuestionProps {
  id: string;
  prompt: string;
  questionNumber?: number;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
  hint?: string | null;
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

  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  const handleSubmit = () => {
    if (answer.trim()) {
      onSubmit(answer.trim());
    }
  };

  return (
    <QuestionShell type="detailed_answer" prompt={prompt} questionNumber={questionNumber} hint={hint}>
      <div className="space-y-4">
        <SpeechTextarea
          value={answer}
          onChange={setAnswer}
          placeholder="Type your answer here or use the mic..."
          disabled={disabled}
        />

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{wordCount} words</span>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={!answer.trim() || disabled} className="mt-4 w-full">
        Submit Answer
      </Button>
    </QuestionShell>
  );
};

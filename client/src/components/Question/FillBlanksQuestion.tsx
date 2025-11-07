import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuestionShell } from "./QuestionShell";

interface FillBlanksQuestionProps {
  id: string;
  prompt: string;
  blanks: number;
  questionNumber?: number;
  onSubmit: (answer: string[]) => void;
  disabled?: boolean;
}

export const FillBlanksQuestion = ({
  id,
  prompt,
  blanks,
  questionNumber,
  onSubmit,
  disabled,
}: FillBlanksQuestionProps) => {
  const [answers, setAnswers] = useState<string[]>(Array(blanks).fill(""));

  const handleChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    const allFilled = answers.every((a) => a.trim() !== "");
    if (allFilled) {
      onSubmit(answers);
    }
  };

  const allFilled = answers.every((a) => a.trim() !== "");

  return (
    <QuestionShell type="fill" prompt={prompt} questionNumber={questionNumber}>
      <div className="space-y-4">
        {Array.from({ length: blanks }).map((_, idx) => (
          <div key={idx}>
            <label htmlFor={`${id}-blank-${idx}`} className="mb-2 block text-sm font-medium">
              Blank {idx + 1}
            </label>
            <Input
              id={`${id}-blank-${idx}`}
              value={answers[idx]}
              onChange={(e) => handleChange(idx, e.target.value)}
              placeholder={`Enter answer for blank ${idx + 1}`}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!allFilled || disabled}
        className="mt-6 w-full"
      >
        Submit Answer
      </Button>
    </QuestionShell>
  );
};

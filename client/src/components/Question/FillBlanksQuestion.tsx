import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuestionShell } from "./QuestionShell";

interface FillBlanksQuestionProps {
  id: string;
  prompt: string;             // e.g. "The capital of France is ___ and currency is ___"
  blanks: number;         // number of blanks to fill
  questionNumber?: number;
  onSubmit: (answer: string[]) => void;
  disabled?: boolean;
}

export const FillBlanksQuestion = ({
  id,
  prompt,
  questionNumber,
  onSubmit,
  disabled,
}: FillBlanksQuestionProps) => {

  const parts = prompt.split(/___+/g);  // split by underscores
  const blanks = parts.length - 1;      // number of blanks

  const [answers, setAnswers] = useState<string[]>(
    Array(blanks).fill("")
  );

  const handleChange = (index: number, value: string) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  const handleSubmit = () => {
    const allFilled = answers.every((a) => a.trim());
    if (allFilled) onSubmit(answers);
  };

  const allFilled = answers.every((a) => a.trim());

  return (
    <QuestionShell type="fill_in_the_blanks" prompt={prompt} questionNumber={questionNumber}>
      <div className="space-y-4">
        <p className="leading-relaxed text-base">
          {parts.map((text, idx) => (
            <span key={idx}>
              {text}
              {idx < blanks && (
                <Input
                  id={`${id}-blank-${idx}`}
                  className="inline-block mx-2 w-40"
                  placeholder={`Blank ${idx + 1}`}
                  value={answers[idx]}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  disabled={disabled}
                />
              )}
            </span>
          ))}
        </p>
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

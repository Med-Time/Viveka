import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuestionShell } from "./QuestionShell";

interface FillBlanksQuestionProps {
  id: string;
  prompt: string;             // e.g. "The capital of France is ___ and currency is ___"
  questionNumber?: number;
  onSubmit: (answer: string[]) => void;
  disabled?: boolean;
  hint?: string;              
}

export const FillBlanksQuestion = ({
  id,
  prompt,
  questionNumber,
  onSubmit,
  disabled,
  hint,
}: FillBlanksQuestionProps) => {
  // split prompt into static parts separated by groups of underscores
  const parts = prompt.split(/___+/g);
  const blanksCount = Math.max(0, parts.length - 1);

  const [answers, setAnswers] = useState<string[]>(
    Array(blanksCount).fill("")
  );

  const handleChange = (index: number, value: string) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  const handleSubmit = () => {
    const allFilled = answers.every((a) => a.trim() !== "");
    if (allFilled) onSubmit(answers);
  };

  const allFilled = answers.every((a) => a.trim() !== "");

  return (
    // NOTE: pass an empty prompt to QuestionShell so it won't duplicate the original text.
    // If QuestionShell's prompt prop is optional you can omit it entirely.
    <QuestionShell type="fill_in_the_blanks" prompt={""} questionNumber={questionNumber}>
      <div className="space-y-4">
        {/* Render only the processed version (parts + inputs) */}
        <p className="leading-relaxed text-base">
          {parts.map((text, idx) => (
            <span key={idx} className="align-middle">
              {text}
              {idx < blanksCount && (
                <Input
                  id={`${id}-blank-${idx}`}
                  className="inline-block mx-2 w-40"
                  placeholder={`Blank ${idx + 1}`}
                  value={answers[idx] || ""}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  disabled={disabled}
                  aria-label={`Blank ${idx + 1}`}
                />
              )}
            </span>
          ))}
        </p>

        {/* Optional hint */}
        {hint && (
          <div className="text-sm text-muted-foreground mt-1 px-2">
            <strong>Hint:</strong> {hint}
          </div>
        )}
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

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QuestionShell } from "./QuestionShell";

interface McqQuestionProps {
  id: string;
  prompt: string;
  options: string[];
  questionNumber?: number;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

export const McqQuestion = ({
  id,
  prompt,
  options,
  questionNumber,
  onSubmit,
  disabled,
}: McqQuestionProps) => {
  const [selected, setSelected] = useState<string>("");

  const handleSubmit = () => {
    if (selected) {
      onSubmit(selected);
    }
  };

  return (
    <QuestionShell type="mcq" prompt={prompt} questionNumber={questionNumber}>
      <RadioGroup value={selected} onValueChange={setSelected} disabled={disabled}>
        <div className="space-y-3">
          {options.map((option, idx) => (
            <div
              key={idx}
              className="flex items-center space-x-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
            >
              <RadioGroupItem value={option} id={`${id}-${idx}`} />
              <Label htmlFor={`${id}-${idx}`} className="flex-1 cursor-pointer">
                {option}
              </Label>
            </div>
          ))}
        </div>
      </RadioGroup>
      <Button
        onClick={handleSubmit}
        disabled={!selected || disabled}
        className="mt-6 w-full"
      >
        Submit Answer
      </Button>
    </QuestionShell>
  );
};

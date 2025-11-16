import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionType } from "@/types/api";

interface QuestionShellProps {
  type: QuestionType;
  prompt: string;
  questionNumber?: number;
  children: React.ReactNode;
  hint?: string | null;
}

export const QuestionShell = ({ type, prompt, questionNumber, children, hint }: QuestionShellProps) => {
  const typeLabels: Record<QuestionType, string> = {
    mcq: "Multiple Choice",
    detailed_answer: "Open Ended",
    fill_in_the_blanks: "Fill in the Blanks",
    one_word_answer: "One Word Answer",
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        {questionNumber && (
          <span className="text-sm font-medium text-muted-foreground">
            Question {questionNumber}
          </span>
        )}
        <Badge variant="secondary">{typeLabels[type]}</Badge>
      </div>
      {hint && (
        <div className="mb-3 rounded border bg-muted/30 p-2 text-sm text-muted-foreground">
          Hint: {hint}
        </div>
      )}
      <h3 className="mb-6 text-lg font-semibold">{prompt}</h3>
      {children}
    </Card>
  );
};

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionType } from "@/types/api";

interface QuestionShellProps {
  type: QuestionType;
  prompt: string;
  questionNumber?: number;
  children: React.ReactNode;
}

export const QuestionShell = ({ type, prompt, questionNumber, children }: QuestionShellProps) => {
  const typeLabels: Record<QuestionType, string> = {
    mcq: "Multiple Choice",
    open: "Open Ended",
    fill: "Fill in the Blanks",
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
      <h3 className="mb-6 text-lg font-semibold">{prompt}</h3>
      {children}
    </Card>
  );
};

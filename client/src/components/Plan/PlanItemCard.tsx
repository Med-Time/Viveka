import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen, ChevronDown, Lock } from "lucide-react";
import { Chapter } from "@/types/api";
import { format } from "date-fns";

interface PlanItemCardProps {
  item: Chapter;
  index: number;
  isLocked?: boolean;
  onStart: () => void;
  onStartSubtopic: (chapterTitle: string, subtopicTitle: string) => void;
}

export const PlanItemCard = ({
  item,
  index,
  isLocked = false,
  onStart,
  onStartSubtopic,
}: PlanItemCardProps) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIdx((prev) => (prev === i ? null : i));
  };

  return (
    <Card
      className={`transition-shadow hover:shadow-md ${
        isLocked ? "opacity-60 bg-muted/10" : ""
      }`}
    >
      <CardHeader>
        <div className="flex items-start justify-between w-full">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={isLocked ? "secondary" : "outline"}>
                {isLocked ? <Lock className="mr-1 h-3 w-3" /> : null}
                Chapter {index + 1}
              </Badge>
              {item.chapter_total_time_minutes && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {item.chapter_total_time_minutes} min
                </span>
              )}
            </div>
            <CardTitle className={isLocked ? "text-muted-foreground" : ""}>
              {item.chapter_title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {item.chapter_outcome}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ul className="mb-4 space-y-2">
          {item.sub_topics.map((subTopic, idx) => {
            const previousSubtopic = item.sub_topics[idx - 1];
            const isSubtopicLocked =
              isLocked || (idx > 0 && !(previousSubtopic as any).completed);

            const isOpen = openIdx === idx;
            const completed = Boolean((subTopic as any).completed);
            const completedAt = (subTopic as any).completed_at;
            const formattedDate = completedAt
              ? format(new Date(completedAt), "PPP p")
              : "";

            return (
              <li key={idx} className="flex flex-col gap-2">
                <div
                  className={`group flex items-center justify-between gap-3 rounded-lg border border-border p-3 
                    ${
                      isSubtopicLocked
                        ? "cursor-not-allowed bg-muted/30"
                        : "hover:bg-muted cursor-pointer"
                    }`}
                  onClick={() => !isSubtopicLocked && toggle(idx)}
                >
                  <div className="flex items-start gap-3">
                    {isSubtopicLocked ? (
                      <Lock className="mt-1 h-3 w-3 text-muted-foreground" />
                    ) : (
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    )}

                    <div className={isSubtopicLocked ? "opacity-50" : ""}>
                      <div className="font-medium text-sm">
                        {subTopic.sub_topic_title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {subTopic.estimated_time_minutes
                          ? `${subTopic.estimated_time_minutes} min`
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {completed && (
                      <div className="relative inline-flex">
                        <Badge className="cursor-default" variant="secondary">
                          Completed
                        </Badge>

                        <div
                          role="tooltip"
                          className={`pointer-events-none absolute right-0 top-full z-20 mt-2 
                            rounded-md border bg-popover p-2 text-xs shadow-lg opacity-0 
                            transition-all duration-200 group-hover:opacity-100`}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <div className="text-xs text-muted-foreground">
                            Completed at
                          </div>
                          <div className="font-medium">{formattedDate}</div>
                          <div className="absolute right-2 -top-1 h-2 w-2 rotate-45 bg-popover border-t border-l" />
                        </div>
                      </div>
                    )}

                    {!isSubtopicLocked && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        } text-muted-foreground`}
                      />
                    )}
                  </div>
                </div>

                {/* Expandable Outcome Section */}
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen && !isSubtopicLocked
                      ? "max-h-96 opacity-100 py-2"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    {isOpen && (
                      <div className="prose max-w-none">
                        {subTopic.sub_topic_outcome || "No outcome provided."}
                      </div>
                    )}

                    <Button
                      size="sm"
                      disabled={isSubtopicLocked}
                      className={buttonVariants({ variant: "ghost" }) + " mt-3"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartSubtopic(
                          item.chapter_title,
                          subTopic.sub_topic_title
                        );
                      }}
                    >
                      Go to this Subtopic
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <Button
          onClick={onStart}
          disabled={isLocked}
          className="w-full gap-2"
          variant={isLocked ? "secondary" : "default"}
        >
          {isLocked ? (
            <Lock className="h-4 w-4" />
          ) : (
            <BookOpen className="h-4 w-4" />
          )}
          {isLocked
            ? "Complete previous chapter to unlock"
            : "Start Chapter"}
        </Button>
      </CardContent>
    </Card>
  );
};

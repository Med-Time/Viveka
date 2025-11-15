import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen, ChevronDown } from "lucide-react";
import { Chapter } from "@/types/api";
import { format } from "date-fns";

interface PlanItemCardProps {
  item: Chapter;
  index: number;
  onStart: () => void;
}

/**
 * PlanItemCard
 * - Click a subtopic row to toggle showing its outcome (with a small fade/slide).
 * - If a subtopic is completed and has completed_at, hovering its badge shows a styled tooltip.
 */
export const PlanItemCard = ({ item, index, onStart }: PlanItemCardProps) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIdx((prev) => (prev === i ? null : i));
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between w-full">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline">Chapter {index + 1}</Badge>
              {item.chapter_total_time_minutes && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {item.chapter_total_time_minutes} min
                </span>
              )}
            </div>
            <CardTitle>{item.chapter_title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">{item.chapter_outcome}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ul className="mb-4 space-y-2">
          {item.sub_topics.map((subTopic, idx) => {
            const isOpen = openIdx === idx;
            const completed = Boolean((subTopic as any).completed);
            const completedAt = (subTopic as any).completed_at;
            const formattedDate =
              completedAt ? format(new Date(completedAt), "PPP p") : "";

            return (
              <li key={idx} className="flex flex-col gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggle(idx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(idx);
                    }
                  }}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div className="font-medium text-sm">{subTopic.sub_topic_title}</div>
                      <div className="text-xs text-muted-foreground">
                        {subTopic.estimated_time_minutes
                          ? `${subTopic.estimated_time_minutes} min`
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {completed && (
                      // wrapper is relative so tooltip can be positioned absolutely
                      <div className="relative inline-flex">
                        <Badge className="cursor-default" variant="secondary">
                          Completed
                        </Badge>

                        {/* Tooltip: appears on group-hover / hover of badge (for mouse) and on focus (keyboard) */}
                        <div
                          role="tooltip"
                          className={`pointer-events-none absolute right-0 top-full z-20 mt-2 w-max max-w-xs transform rounded-md border bg-popover p-2 text-xs shadow-lg opacity-0 transition-all duration-200 
                            group-hover:opacity-100 group-focus-within:opacity-100
                            ${formattedDate ? "translate-y-0" : "hidden"}`}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <div className="px-2 py-1">
                            <div className="text-xs text-muted-foreground">Completed at</div>
                            <div className="font-medium">{formattedDate || "-"}</div>
                          </div>
                          {/* small arrow */}
                          <div className="absolute right-2 -top-1 h-2 w-2 rotate-45 bg-popover border-t border-l" />
                        </div>
                      </div>
                    )}

                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : "rotate-0"
                      } text-muted-foreground`}
                    />
                  </div>
                </div>

                {/* Expandable outcome panel */}
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen ? "max-h-96 opacity-100 py-2" : "max-h-0 opacity-0"
                  }`}
                >
                  {/* content area with small fade + slide effect */}
                  <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                    {/* Only render the paragraph when open to avoid layout jumps */}
                    {isOpen && (
                      <div className="prose max-w-none">
                        {subTopic.sub_topic_outcome || "No outcome provided for this subtopic."}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <Button onClick={onStart} className="w-full gap-2">
          <BookOpen className="h-4 w-4" />
          Start Chapter
        </Button>
      </CardContent>
    </Card>
  );
};

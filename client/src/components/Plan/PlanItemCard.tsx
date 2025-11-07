import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen } from "lucide-react";
import { Chapter, LessonPlanItem } from "@/types/api";

interface PlanItemCardProps {
  item: Chapter;
  index: number;
  onStart: () => void;
}

export const PlanItemCard = ({ item, index, onStart }: PlanItemCardProps) => {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between">
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="mb-4 space-y-2">
          {item.sub_topics.map((subTopic, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{subTopic.sub_topic_title}</span>
            </li>
          ))}
        </ul>
        <Button onClick={onStart} className="w-full gap-2">
          <BookOpen className="h-4 w-4" />
          Start Chapter
        </Button>
      </CardContent>
    </Card>
  );
};

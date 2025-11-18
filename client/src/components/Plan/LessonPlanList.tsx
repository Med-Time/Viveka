import { Chapter, LessonPlanItem } from "@/types/api";
import { PlanItemCard } from "./PlanItemCard";
import { useNavigate } from "react-router-dom";


interface ChapterListProps {
  items: Chapter[];
  onStartChapter: (chapterIdx: number) => void;
}

export const LessonPlanList = ({ items, onStartChapter }: ChapterListProps) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <PlanItemCard
          key={item.chapter_title}
          item={item}
          index={idx}
          onStart={() => onStartChapter(idx)}
          onStartSubtopic={(chapterIdx, subtopicIdx) => {
            navigate(`/content/${chapterIdx}/${subtopicIdx}`);
          }}
        />
      ))}
    </div>
  );
};

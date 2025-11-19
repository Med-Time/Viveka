import { Chapter, LessonPlanItem } from "@/types/api";
import { PlanItemCard } from "./PlanItemCard";
import { useNavigate } from "react-router-dom";


interface ChapterListProps {
  items: Chapter[];
  onStartChapter: (chapterIdx: number) => void;
}

export const LessonPlanList = ({ items, onStartChapter }: ChapterListProps) => {
  const navigate = useNavigate();

  // Helper: A chapter is complete only if ALL its subtopics are marked completed
  const isChapterComplete = (chapter: any) => {
    return chapter.sub_topics?.every((st: any) => !!st.completed);
  };

  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        // The first chapter (index 0) is always unlocked.
        // Subsequent chapters are locked if the previous chapter is NOT complete.
        const isLocked = idx > 0 && !isChapterComplete(items[idx - 1]);

        return (
          <PlanItemCard
            key={item.chapter_title}
            item={item}
            index={idx}
            isLocked={isLocked} // <--- Passing the new prop here
            onStart={() => onStartChapter(idx)}
            onStartSubtopic={(chapterIdx, subtopicIdx) => {
              navigate(`/content/${chapterIdx}/${subtopicIdx}`);
            }}
          />
        );
      })}
    </div>
  );
};
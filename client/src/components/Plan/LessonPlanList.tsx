import { Chapter } from "@/types/api";
import { PlanItemCard } from "./PlanItemCard";
import { useNavigate } from "react-router-dom";
import { slugify } from "@/utils/slug";

interface ChapterListProps {
  items: Chapter[];
  onStartChapter: (chapterIdx: number) => void;
}

export const LessonPlanList = ({ items, onStartChapter }: ChapterListProps) => {
  const navigate = useNavigate();

  // A chapter is complete only if ALL its subtopics are marked completed
  const isChapterComplete = (chapter: any) => {
    return chapter.sub_topics?.every((st: any) => !!st.completed);
  };

  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        // First chapter is always unlocked; others depend on previous completion
        const isLocked = idx > 0 && !isChapterComplete(items[idx - 1]);

        return (
          <PlanItemCard
            key={item.chapter_title}
            item={item}
            index={idx}
            isLocked={isLocked}
            onStart={() => onStartChapter(idx)}
            onStartSubtopic={(chapterTitle: string, subtopicTitle: string) => {
              const chapterSlug = encodeURIComponent(slugify(chapterTitle));
              const subtopicSlug = encodeURIComponent(slugify(subtopicTitle));
              navigate(`/content/${chapterSlug}/${subtopicSlug}`);
            }}
          />
        );
      })}
    </div>
  );
};

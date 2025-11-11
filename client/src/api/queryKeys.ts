export const queryKeys = {
  health: ["health"],
  interview: {
    start: ["interview", "start"],
    session: (studyId: string) => ["interview", "session", studyId],
  },
  persona: (studyId: string) => ["persona", studyId],
  lessonPlan: {
    get: (studyId: string) => ["lessonPlan", studyId],
    generate: (studyId: string) => ["lessonPlan", "generate", studyId],
  },
  content: {
    get: (studyId: string, chapterIdx: number) => ["content", studyId, chapterIdx],
    generate: (studyId: string, chapterIdx: number) => ["content", "generate", studyId, chapterIdx],
  },
};

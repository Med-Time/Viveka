export const queryKeys = {
  health: ["health"],
  interview: {
    start: ["interview", "start"],
    session: (sessionId: string) => ["interview", "session", sessionId],
  },
  persona: (sessionId: string) => ["persona", sessionId],
  lessonPlan: {
    get: (sessionId: string) => ["lessonPlan", sessionId],
    generate: (sessionId: string) => ["lessonPlan", "generate", sessionId],
  },
  content: {
    get: (sessionId: string, chapterIdx: number) => ["content", sessionId, chapterIdx],
    generate: (sessionId: string, chapterIdx: number) => ["content", "generate", sessionId, chapterIdx],
  },
};

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check, ZoomIn, ZoomOut } from "lucide-react";
import { contentApi } from "./content.api";
import { queryKeys } from "@/api/queryKeys";
import { toast } from "@/hooks/use-toast";
import { safeGetJson } from "@/utils/storage";
import Assistant from '../ai_assistant/assistant';
import Assistant_style from "../ai_assistant/assistant_style.module.css"

export const ContentPage = () => {
  // Accept optional subtopic index in the URL: /content/:chapter_idx/:subtopic_idx
  const params = useParams<Record<string, string>>();
  const chapterIdx = parseInt(params.chapter_idx || "0", 10);
  const subtopicIdx = parseInt(params.subtopic_idx || "0", 10); // default 0
  const navigate = useNavigate();

  // Prefer explicit selected study id in localStorage, fallback to user object
  const auth = safeGetJson("user") || {};
  const persisted = localStorage.getItem("current_study_id");
  const userStudies: { study_id?: string; subject?: string; created_at?: string }[] = auth?.studies || [];
  const validPersisted =
    persisted && userStudies.some((s) => s.study_id === persisted) ? persisted : null;
  const initial = validPersisted || userStudies?.[0]?.study_id || auth?.current_study_id || null;

  const [currentStudyId, setCurrentStudyId] = useState<string | null>(initial);
  const [showStudySelector, setShowStudySelector] = useState<boolean>(!Boolean(currentStudyId));
  const [fontSize, setFontSize] = useState(16);

  useEffect(() => {
    setShowStudySelector(!Boolean(currentStudyId) && userStudies && userStudies.length > 0);
  }, [currentStudyId, userStudies]);

  const handleSelectStudy = (id: string) => {
    if (!id) return;
    localStorage.setItem("current_study_id", id);
    setCurrentStudyId(id);
    setShowStudySelector(false);
  };

  // If no study selected, prompt user to choose or navigate to dashboard/onboarding
  if (!currentStudyId) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
          <Card className="max-w-md text-center">
            <Card className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-4">Select a study to continue</h2>
              {userStudies && userStudies.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {userStudies.map((s, i) => (
                    <div key={s.study_id || i} className="flex items-center justify-between gap-4">
                      <div className="text-left">
                        <div className="font-medium">{s.subject || `Study ${i + 1}`}</div>
                        <div className="text-sm text-muted-foreground">
                          {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                      <Button onClick={() => handleSelectStudy(s.study_id || "")}>Select</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="mb-4 text-muted-foreground">No studies found. Start onboarding or create a study.</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => navigate("/onboarding")}>Onboarding</Button>
                    <Button variant="outline" onClick={() => navigate("/interview")}>Start Assessment</Button>
                  </div>
                </div>
              )}
            </Card>
          </Card>
        </div>
      </div>
    );
  }

  // Use currentStudyId for queries and generation
  const studyID = currentStudyId;

  const [hasGenerated, setHasGenerated] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const { data: content, isLoading, refetch } = useQuery({
    queryKey: queryKeys.content.get(studyID, chapterIdx),
    queryFn: () => contentApi.get(studyID, chapterIdx),
    enabled: hasGenerated === true && !!studyID,
  });

  const generateMutation = useMutation({
    mutationFn: () => contentApi.generate(studyID, chapterIdx),
    onSuccess: () => {
      setHasGenerated(true);
      toast({
        title: "Generating content",
        description: "Your personalized lesson content is being created...",
      });
      setTimeout(() => {
        refetch();
      }, 2000);
    },
  });

  useEffect(() => {
    if (!studyID) {
      setHasGenerated(false);
      return;
    }
    let mounted = true;
    (async () => {
      setChecking(true);
      try {
        await contentApi.get(studyID, chapterIdx);
        if (!mounted) return;
        setHasGenerated(true);
      } catch (err) {
        if (!mounted) return;
        setHasGenerated(false);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [studyID, chapterIdx]);

  const handleGenerate = () => {
    if (!studyID) {
      toast({ title: "Error", description: "Missing session id", variant: "destructive" });
      return;
    }
    generateMutation.mutate();
  };

  // Normalize generated_content into list of { title, body }
  const generatedRaw = (content as any)?.generated_content;
  const normalizedSubtopics: { title: string; body: string }[] = [];

  if (generatedRaw) {
    if (Array.isArray(generatedRaw)) {
      generatedRaw.forEach((item: any, i: number) => {
        if (typeof item === "string") {
          normalizedSubtopics.push({ title: `Subtopic ${i + 1}`, body: item });
        } else if (item && typeof item === "object") {
          const title =
            item.subtopic_title || item.title || item.sub_topic_title || item.name || `Subtopic ${i + 1}`;
          const body = item.content || item.text || item.body || "";
          normalizedSubtopics.push({ title, body });
        } else {
          normalizedSubtopics.push({ title: `Subtopic ${i + 1}`, body: String(item) });
        }
      });
    } else if (generatedRaw && typeof generatedRaw === "object") {
      Object.entries(generatedRaw).forEach(([k, v], i) => {
        if (typeof v === "string") {
          normalizedSubtopics.push({ title: k, body: v });
        } else if (v && typeof v === "object") {
          const body = v.content || v.text || v.body || JSON.stringify(v);
          normalizedSubtopics.push({ title: k, body });
        } else {
          normalizedSubtopics.push({ title: k, body: String(v) });
        }
      });
    } else if (typeof generatedRaw === "string") {
      normalizedSubtopics.push({ title: (content as any).chapter_title || "Subtopic 1", body: generatedRaw });
    }
  }

  const totalSubtopics = normalizedSubtopics.length;
  const currentIdx = Math.max(0, Math.min(totalSubtopics - 1, isNaN(subtopicIdx) ? 0 : subtopicIdx));
  const currentTitle = normalizedSubtopics[currentIdx]?.title || "";
  const currentContent = normalizedSubtopics[currentIdx]?.body || "";

  // Navigation (subtopic within chapter; if boundary, navigate to prev/next chapter)
  const goToSubtopic = (idx: number) => {
    // update last_read before navigation
    try {
      const payload = {
        studyID,
        chapterIdx,
        subtopicIdx: idx,
        chapterTitle: (content as any)?.chapter_title || `Chapter ${chapterIdx}`,
        subtopicTitle:
          normalizedSubtopics[idx]?.title ||
          Object.keys((content as any)?.generated_content || {})[idx] ||
          `Subtopic ${idx + 1}`,
      };
      localStorage.setItem("last_read", JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
    navigate(`/content/${chapterIdx}/${idx}`);
    // reset state so page re-checks existence
    setHasGenerated(null);
  };

  const handlePrevious = () => {
    if (currentIdx > 0) {
      goToSubtopic(currentIdx - 1);
    } else if (chapterIdx > 0) {
      // go to previous chapter last subtopic
      // we navigate to previous chapter; UI will re-check and default to subtopic 0 — adjust if you want last
      navigate(`/content/${chapterIdx - 1}/0`);
      setHasGenerated(null);
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 < totalSubtopics) {
      goToSubtopic(currentIdx + 1);
    } else {
      // move to next chapter first subtopic
      navigate(`/content/${chapterIdx + 1}/0`);
      setHasGenerated(null);
    }
  };

  // also persist when user marks complete or navigates next/previous
  const handleComplete = () => {
    try {
      const payload = {
        studyID,
        chapterIdx,
        subtopicIdx: currentIdx,
        chapterTitle: (content as any)?.chapter_title || `Chapter ${chapterIdx}`,
        subtopicTitle: currentTitle,
      };
      localStorage.setItem("last_read", JSON.stringify(payload));
    } catch {}
    toast({
      title: "Subtopic completed!",
      description: "Great progress! Keep learning.",
    });
  };

  const [assistantOpen, setAssistantOpen] = useState(false);

  if (checking || isLoading || generateMutation.isPending) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">
              {checking ? "Checking for existing content..." : "Loading chapter content..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasGenerated === false) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground mb-4">No content exists for this chapter yet.</p>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? "Generating..." : "Generate Chapter Content"}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Content not available.</p>
          </Card>
        </div>
      </div>
    );
  }

  // Render single subtopic
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
       <div className={Assistant_style.container}>
      <button
        onClick={() => setAssistantOpen(true)}
        style={{
          position: 'fixed',
          right: 30,
          top: 600,
          zIndex: 80,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          padding: '8px 12px',
          borderRadius: 8,
          cursor: 'pointer'
        }}
      >
       💬 AI Assistant
      </button>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{(content as any).chapter_title || `Chapter ${chapterIdx}`}</h1>
            <div className="text-sm text-muted-foreground">
              {currentTitle ? `${currentTitle} — Subtopic ${currentIdx + 1} of ${totalSubtopics}` : "No subtopic"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFontSize(Math.max(12, fontSize - 2))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFontSize(Math.min(24, fontSize + 2))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="mb-6 p-8" style={{ fontSize: `${fontSize}px` }}>
          <MarkdownRenderer content={currentContent || "No content for this subtopic."} />
        </Card>

        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" onClick={handlePrevious} disabled={chapterIdx === 0 && currentIdx === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <Button variant="secondary" onClick={handleComplete}>
            <Check className="mr-2 h-4 w-4" />
            Mark Complete
          </Button>

          <Button onClick={handleNext}>
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
      <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  </div> 
  );
};

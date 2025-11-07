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

export const ContentPage = () => {
  // Accept optional subtopic index in the URL: /content/:chapter_idx/:subtopic_idx
  const params = useParams<Record<string, string>>();
  const chapterIdx = parseInt(params.chapter_idx || "0", 10);
  const subtopicIdx = parseInt(params.subtopic_idx || "0", 10); // default 0
  const navigate = useNavigate();
  const auth = JSON.parse(localStorage.getItem("user") || "{}");
  const sessionId = auth?.id;
  const [fontSize, setFontSize] = useState(16);

  const [hasGenerated, setHasGenerated] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const { data: content, isLoading, refetch } = useQuery({
    queryKey: queryKeys.content.get(sessionId, chapterIdx),
    queryFn: () => contentApi.get(sessionId, chapterIdx),
    enabled: hasGenerated === true && !!sessionId,
  });

  const generateMutation = useMutation({
    mutationFn: () => contentApi.generate(sessionId, chapterIdx),
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
    if (!sessionId) {
      setHasGenerated(false);
      return;
    }
    let mounted = true;
    (async () => {
      setChecking(true);
      try {
        await contentApi.get(sessionId, chapterIdx);
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
  }, [sessionId, chapterIdx]);

  const handleGenerate = () => {
    if (!sessionId) {
      toast({ title: "Error", description: "Missing session id", variant: "destructive" });
      return;
    }
    generateMutation.mutate();
  };

  // Helpers to work with generated_content shape
  const subtopicTitles = content
    ? Array.isArray((content as any).generated_content)
      ? [] // if an array (unexpected) keep empty
      : Object.keys((content as any).generated_content || {})
    : [];

  const totalSubtopics = subtopicTitles.length;
  const currentIdx = Math.max(0, Math.min(totalSubtopics - 1, isNaN(subtopicIdx) ? 0 : subtopicIdx));
  const currentTitle = subtopicTitles[currentIdx] || "";
  const currentContent =
    content && (content as any).generated_content
      ? (content as any).generated_content[currentTitle] ||
        // fallback: if generated_content is an array/value
        (Array.isArray((content as any).generated_content) ? (content as any).generated_content[currentIdx] : "")
      : "";

  // Navigation (subtopic within chapter; if boundary, navigate to prev/next chapter)
  const goToSubtopic = (idx: number) => {
    navigate(`/content/${idx}`);
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

  const handleComplete = () => {
    toast({
      title: "Subtopic completed!",
      description: "Great progress! Keep learning.",
    });
  };

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
    </div>
  );
};

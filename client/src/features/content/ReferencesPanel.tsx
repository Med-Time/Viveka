import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Reference } from "./content.api";

interface ReferencesPanelProps {
  references: Reference[] | undefined;
  isLoading: boolean;
  error?: string | null;
}

export const ReferencesPanel = ({ references, isLoading, error }: ReferencesPanelProps) => {
  const [expanded, setExpanded] = useState(true);

  if (!references || references.length === 0) {
    return null; // Don't show panel if no references
  }

  return (
    <div className="sticky top-4 max-h-[80vh] overflow-y-auto">
      <Card className="p-4 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Verified References</h3>
            <Badge variant="outline" className="text-xs">{references.length}</Badge>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {!expanded && (
          <p className="text-xs text-muted-foreground">Collapsed</p>
        )}

        {expanded && (
          <div className="space-y-3">
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="flex gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {references.map((ref, idx) => (
              <div
                key={`${ref.url || ref.title}-${idx}`}
                className="p-3 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                {/* Title + Verified Badge */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    {ref.url ? (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-words"
                      >
                        {ref.title || "Reference"}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-foreground">{ref.title || "Reference"}</span>
                    )}
                  </div>
                  {ref.verified && (
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  )}
                </div>

                {/* Domain/Source Badge */}
                <div className="flex gap-2 mb-2">
                  {ref.domain && (
                    <Badge
                      variant={ref.source_type === "local" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {ref.domain}
                    </Badge>
                  )}
                  {ref.source_type && (
                    <Badge variant="outline" className="text-xs">
                      {ref.source_type === "local" ? "📚 Local" : "🌐 Web"}
                    </Badge>
                  )}
                </div>

                {/* Snippet */}
                {ref.snippet && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {ref.snippet}
                  </p>
                )}

                {/* Open Link Button (if URL available) */}
                {ref.url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={() => window.open(ref.url, "_blank")}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

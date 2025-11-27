import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Download, Share2, X, AlertCircle, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { certificateApi } from "./certificate.api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

type Certificate = {
  study_id: string;
  student_name: string;
  course_title: string;
  completion_date: string;
  certificate_id: string;
};

export function CertificatePage() {
  const { studyId } = useParams<{ studyId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch certificate on mount using certificateApi
  useEffect(() => {
    if (!studyId) {
      setError("Study ID not found");
      setLoading(false);
      return;
    }

    const fetchCertificate = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use certificateApi.getCertificate
        const data: Certificate = await certificateApi.getCertificate(studyId);
        console.log("Fetched certificate data:", data);
        setCertificate(data);
        toast({ title: "Success", description: "Certificate generated" });
      } catch (err: any) {
        const errorMsg = err.response?.data?.detail || err.message || "Error loading certificate";
        setError(errorMsg);
        console.error("Certificate fetch error:", err);
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchCertificate();
  }, [studyId]);

  // Download PDF using certificateApi
  const handleDownload = async () => {
    if (!studyId) return;

    try {
      setDownloading(true);

      // Use certificateApi.downloadCertificate with responseType blob
      const response = await certificateApi.downloadCertificate(studyId);

      // Ensure we got a blob (PDF)
      if (!(response instanceof Blob)) {
        throw new Error("Invalid response: expected PDF file");
      }

      // Trigger download
      const url = window.URL.createObjectURL(response);
      const link = document.createElement("a");
      link.href = url;
      link.download = `viveka_certificate_${studyId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: "Success", description: "Certificate downloaded successfully" });
    } catch (err: any) {
      console.error("Download error:", err);
      const errorMsg = err.response?.data?.detail || err.message || "Could not download certificate";
      toast({ title: "Download failed", description: errorMsg, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  // Share certificate (Web Share API or clipboard)
  const handleShare = async () => {
    if (!certificate) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Certificate of Completion - Viveka",
          text: `I just completed ${certificate.course_title} on Viveka!`,
          url: window.location.href,
        });
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast({ title: "Copied", description: "Certificate link copied to clipboard" });
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const issuedOn =
    certificate?.completion_date
      ? new Date(certificate.completion_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-slate-600 text-sm">Generating certificate…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !certificate) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Viveka logo"
                className="h-7 w-7 object-contain"
              />
              <span className="text-xl font-bold">Viveka</span>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  {user?.full_name || user?.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Error content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-red-200 bg-red-50">
            <div className="p-6 text-center space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Certificate Not Available</h3>
                <p className="text-red-600 text-sm">{error || "Certificate not found"}</p>
              </div>
              <Button
                onClick={() => navigate("/dashboard")}
                className="w-full"
                variant="outline"
              >
                Go to Dashboard
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Success state - show certificate
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header - Same as AppHeader */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Viveka logo"
              className="h-7 w-7 object-contain"
            />
            <span className="text-xl font-bold">Viveka</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              disabled={downloading}
              size="sm"
              className="inline-flex items-center justify-center gap-2"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Download</span>
            </Button>

            <Button
              onClick={handleShare}
              size="sm"
              variant="outline"
              className="inline-flex items-center justify-center"
              title="Share certificate"
            >
              <Share2 className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user?.full_name || user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Certificate display */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-8 md:p-10">
          <div className="relative border-2 border-primary/20 rounded-2xl px-8 md:px-14 py-10 md:py-12 bg-gradient-to-br from-slate-50 to-white">
            {/* Corner accents */}
            <div className="absolute left-4 top-4 h-6 w-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <div className="absolute right-4 top-4 h-6 w-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <div className="absolute left-4 bottom-4 h-6 w-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <div className="absolute right-4 bottom-4 h-6 w-6 border-b-4 border-r-4 border-primary rounded-br-lg" />

            {/* Viveka Logo at top center */}
            <div className="flex justify-center mb-4">
              <img
                src="/logo.png"
                alt="Viveka"
                className="h-12 md:h-16 object-contain"
              />
            </div>

            {/* Certificate content */}
            <div className="flex flex-col items-center text-center gap-2 md:gap-3">
              <h1 className="text-xl md:text-3xl font-bold text-slate-900">
                Certificate of Completion
              </h1>

              <p className="text-xs md:text-sm text-slate-500 mt-2">
                This certificate is proudly presented to
              </p>

              <p className="text-2xl md:text-4xl font-extrabold text-primary mt-2 break-words">
                {certificate.student_name}
              </p>

              <p className="text-xs md:text-sm text-slate-500 mt-2">
                for successfully completing the course
              </p>

              <p className="text-base md:text-xl font-semibold text-slate-900 mt-2 break-words">
                {certificate.course_title}
              </p>

              <p className="text-xs md:text-sm text-slate-500 mt-4">
                on the Viveka learning platform
              </p>
            </div>

            {/* Footer with issue date and seal */}
            <div className="mt-8 md:mt-12 flex items-end justify-between text-xs md:text-sm">
              <div className="flex flex-col gap-1">
                <span className="uppercase tracking-widest text-[10px] text-slate-400 font-medium">
                  Issued on
                </span>
                <span className="font-bold text-slate-900 text-sm md:text-base">
                  {issuedOn}
                </span>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xl font-bold shadow-md">
                  ✓
                </div>
                <div className="text-[10px] md:text-xs text-slate-600 text-right">
                  <div className="font-semibold">Viveka</div>
                  <div className="text-slate-500">Official</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

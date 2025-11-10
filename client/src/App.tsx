import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HomePage } from "./pages/HomePage";
import { DashboardPage } from "./pages/DashboardPage";
import { AuthPage } from "./features/auth/AuthPage";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { InterviewPage } from "./features/interview/InterviewPage";
import { PersonaPage } from "./features/persona/PersonaPage";
import { LessonPlanPage } from "./features/lessonPlan/LessonPlanPage";
import { ContentPage } from "./features/content/ContentPage";
import { ProtectedRoute } from "./components/Layout/ProtectedRoute";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { safeGetJson } from "@/utils/storage";

const queryClient = new QueryClient();

export const App = () => {
  useEffect(() => {
    // Validate saved current_study_id on app start (and after login if you re-mount)
    const user = safeGetJson("user");
    const persisted = localStorage.getItem("current_study_id");
    if (!persisted) return;

    // If there's no logged-in user or user has no studies, clear persisted value
    if (!user || !Array.isArray(user.studies) || user.studies.length === 0) {
      localStorage.removeItem("current_study_id");
      return;
    }

    // If persisted id doesn't belong to this user's studies, pick first study (if any) or clear
    const belongs = user.studies.some((s: any) => s?.study_id === persisted);
    if (!belongs) {
      const first = user.studies[0]?.study_id;
      if (first) {
        localStorage.setItem("current_study_id", first);
      } else {
        localStorage.removeItem("current_study_id");
      }
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview"
                element={
                  <ProtectedRoute>
                    <InterviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/persona"
                element={
                  <ProtectedRoute>
                    <PersonaPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lesson-plan"
                element={
                  <ProtectedRoute>
                    <LessonPlanPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/content/:chapter_idx"
                element={
                  <ProtectedRoute>
                    <ContentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/content/:chapter_idx/:subtopic_idx"
                element={
                  <ProtectedRoute>
                    <ContentPage />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

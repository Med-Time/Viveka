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

const queryClient = new QueryClient();

const App = () => (
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
                <DashboardPage />
                // <ProtectedRoute>
                // </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                  <OnboardingPage />
                // <ProtectedRoute>
                // </ProtectedRoute>
              }
            />
            <Route
              path="/interview"
              element={
                  <InterviewPage />
                // <ProtectedRoute>
                // </ProtectedRoute>
              }
            />
            <Route
              path="/persona"
              element={
                  <PersonaPage />
                // <ProtectedRoute>
                // </ProtectedRoute>
              }
            />
            <Route
              path="/lesson-plan"
              element={
                  <LessonPlanPage />
                // <ProtectedRoute>
                // </ProtectedRoute>
              }
            />
            <Route
              path="/content/:chapter_idx"
              element={
                  <ContentPage />
                // <ProtectedRoute>
                // </ProtectedRoute>
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

export default App;

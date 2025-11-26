import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/Layout/AppHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { interviewApi } from "@/features/interview/interview.api";
import { safeGetJson, safeSetJson } from "@/utils/storage";
import { StartInterviewRequest, StartInterviewResponse } from "@/types/api";

const onboardingSchema = z.object({
  course: z.string().min(1, "Please select a course"),
  priorKnowledge: z.string().min(10, "Please provide some details about your background"),
  specificGoals: z.string().min(10, "Please describe your goals"),
  difficulty: z.string().min(1, "Please select a difficulty level"),
  hoursPerWeek: z.coerce.number().min(1, "Please enter hours per week"),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
  });

  const onSubmit = async (data: OnboardingFormData) => {
  const storedUser = safeGetJson("user");
  const userId =
    storedUser?.id || storedUser?.user?.id || localStorage.getItem("id") || "";
  if (!userId) {
    toast({
      title: "Not logged in",
      description: "Please login and try again.",
      variant: "destructive",
    });
    return;
  }

  const clean = (s: string) => s.trim().replace(/\s+/g, " ");
  const toTitleCase = (s: string) =>
    clean(s)
      .toLowerCase()
      .replace(/\b([a-z])/g, (_m, ch) => ch.toUpperCase());

  const processedCourse = toTitleCase(data.course);

  const payload: StartInterviewRequest = {
    user_id: userId,
    subject: processedCourse,
    goal: clean(data.specificGoals),
    level: data.difficulty,
    prior_knowledge: clean(data.priorKnowledge),
    hours_per_week: data.hoursPerWeek,
  };

  // Immediate UX: give the user feedback and navigate right away
  toast({
    title: "Starting assessment",
    description: "Preparing your personalized assessment…",
  });

  try {
    // Fire the API call (we await to persist the returned study info)
    const res: StartInterviewResponse = await interviewApi.start(payload);

    // persist study id and also store the full start response so InterviewPage can pick it up
    localStorage.setItem("current_study_id", res.study_id);

    // update user's studies in localStorage (merge or append)
    const user = safeGetJson("user") || {};
    const studies: Array<{ study_id?: string; subject?: string; created_at?: string }> =
      Array.isArray(user.studies) ? user.studies : [];

    const newEntry = {
      study_id: res.study_id,
      subject: payload.subject,
      created_at: new Date().toISOString(),
    };

    const idx = studies.findIndex((s) => s.study_id === res.study_id);
    if (idx >= 0) {
      studies[idx] = { ...studies[idx], ...newEntry };
    } else {
      studies.push(newEntry);
    }
    user.studies = studies;
    safeSetJson("user", user);
    // Optional: show success toast when API finishes
    toast({
      title: "Assessment ready",
      description: "Your assessment is ready — continue below.",
    });
    navigate("/interview",{ state: { start: res } });
  } catch (err) {
    // If start failed, show an error toast; InterviewPage should handle the missing start gracefully.
    toast({
      title: "Failed to start",
      description: err instanceof Error ? err.message : "Please try again.",
      variant: "destructive",
    });
    // You could optionally navigate back to onboarding here:
    navigate("/onboarding");
  }
};

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Personalize Your Learning</CardTitle>
            <CardDescription>
              Help us understand your learning needs and goals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="course">Course / Subject</Label>
                <Textarea
                  id="course"
                  placeholder="Enter the course or subject you want to learn (e.g., Intro to Algorithms)"
                  {...register("course")}
                  rows={1}
                />
                {errors.course && (
                  <p className="text-sm text-destructive">{errors.course.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priorKnowledge">Prior Knowledge & Experience</Label>
                <Textarea
                  id="priorKnowledge"
                  placeholder="What do you already know about this subject?"
                  {...register("priorKnowledge")}
                  rows={4}
                />
                {errors.priorKnowledge && (
                  <p className="text-sm text-destructive">{errors.priorKnowledge.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="specificGoals">Specific Goals</Label>
                <Textarea
                  id="specificGoals"
                  placeholder="What do you want to achieve with this course?"
                  {...register("specificGoals")}
                  rows={4}
                />
                {errors.specificGoals && (
                  <p className="text-sm text-destructive">{errors.specificGoals.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Preferred Difficulty Level</Label>
                <Select onValueChange={(value) => setValue("difficulty", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
                {errors.difficulty && (
                  <p className="text-sm text-destructive">{errors.difficulty.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hoursPerWeek">Available Time Per Week (hours)</Label>
                <Input
                  id="hoursPerWeek"
                  type="number"
                  placeholder="5"
                  {...register("hoursPerWeek")}
                />
                {errors.hoursPerWeek && (
                  <p className="text-sm text-destructive">{errors.hoursPerWeek.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg">
                Start Assessment
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

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
    try {
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

      const payload: StartInterviewRequest = {
        user_id: userId,
        subject: data.course,
        goal: data.specificGoals,
        level: data.difficulty,
        prior_knowledge: data.priorKnowledge,
        hours_per_week: data.hoursPerWeek,
      };

      const res: StartInterviewResponse = await interviewApi.start(payload);

      localStorage.setItem("current_study_id", res.study_id);
      toast({
        title: "Preferences saved!",
        description: "Let's begin your assessment.",
      });
      navigate("/interview", {state: {start: res}});
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to start interview. Try again.",
        variant: "destructive",
      });
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

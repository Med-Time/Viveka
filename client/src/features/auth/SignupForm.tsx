import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { authApi } from "./auth.api";
import { useAuth } from "@/hooks/useAuth";
import { safeSetJson } from "@/utils/storage";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  age: z.coerce.number().min(5, "Age must be at least 5").optional(),
  goals: z.string().optional(),
  learning_pace: z.string().optional(),
  interests: z.string().optional()
});

type SignupFormData = z.infer<typeof signupSchema>;

export const SignupForm = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const signupMutation = useMutation({
    mutationFn: authApi.signup,
    onSuccess: (data) => {
      toast({
        title: "Account created",
        description: "Please login with your email and password to continue.",
      });
      navigate("/auth?view=login");
    },
    onError: (error: any) => {
      toast({
        title: "Signup failed",
        description: error.response?.data?.message || "Could not create account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    const interests = data.interests ? data.interests.split(",").map(i => i.trim()) : null;
    signupMutation.mutate({
      email: data.email,
      password: data.password,
      name: data.name,
      age: data.age,
      goals: data.goals,
      learning_pace: data.learning_pace,
      interests,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="John Doe"
          {...register("name")}
          disabled={signupMutation.isPending}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          {...register("email")}
          disabled={signupMutation.isPending}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          {...register("password")}
          disabled={signupMutation.isPending}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="age">Age (optional)</Label>
        <Input
          id="age"
          type="number"
          placeholder="25"
          {...register("age")}
          disabled={signupMutation.isPending}
        />
        {errors.age && (
          <p className="text-sm text-destructive">{errors.age.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="interests">Interests (optional, comma-separated)</Label>
        <Input
          id="interests"
          placeholder="Math, Science, History"
          {...register("interests")}
          disabled={signupMutation.isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goals">Learning Goals (optional)</Label>
        <Textarea
          id="goals"
          placeholder="What do you want to achieve?"
          {...register("goals")}
          disabled={signupMutation.isPending}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="learning_pace">Preferred Learning Pace (optional)</Label>
        <Input
          id="learning_pace"
          placeholder="e.g., Relaxed, Moderate, Intensive"
          {...register("learning_pace")}
          disabled={signupMutation.isPending}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={signupMutation.isPending}
      >
        {signupMutation.isPending ? "Creating account..." : "Sign Up"}
      </Button>
    </form>
  );
};

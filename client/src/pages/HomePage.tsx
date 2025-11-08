import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Target, Zap, Brain, CheckCircle } from "lucide-react";

export const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="gradient-hero relative overflow-hidden py-20 text-white">
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <BookOpen className="h-10 w-10" />
              </div>
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-tight md:text-6xl">
              Your Personalized Learning Journey Starts Here
            </h1>
            <p className="mb-8 text-xl opacity-90">
              Viveka adapts to your unique learning style, pace, and goals to create a custom curriculum just for you.
            </p>
            <Button size="lg" variant="secondary" className="text-lg" asChild>
              <Link to="/auth">Get Started Free</Link>
            </Button>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/20" />
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold">Why Choose Viveka?</h2>
            <p className="text-xl text-muted-foreground">
              Intelligent learning that adapts to you
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border-2 transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Brain className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>AI-Powered Assessment</CardTitle>
                <CardDescription>
                  Our intelligent system evaluates your knowledge and learning style through targeted questions
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                  <Target className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle>Custom Curriculum</CardTitle>
                <CardDescription>
                  Get a personalized lesson plan tailored to your goals, pace, and current knowledge level
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Adaptive Content</CardTitle>
                <CardDescription>
                  Learn with content that adjusts in real-time based on your progress and comprehension
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="gradient-feature py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold">How It Works</h2>
            <p className="text-xl text-muted-foreground">
              Three simple steps to personalized learning
            </p>
          </div>

          <div className="mx-auto max-w-4xl space-y-8">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <CardTitle className="mb-2">Sign Up & Share Your Goals</CardTitle>
                    <CardDescription className="text-base">
                      Tell us about your learning objectives, background, and preferred pace. This helps us understand what you want to achieve.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <CardTitle className="mb-2">Complete Your Assessment</CardTitle>
                    <CardDescription className="text-base">
                      Answer adaptive questions that evaluate your current knowledge and learning style. Get instant feedback on your responses.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <CardTitle className="mb-2">Start Your Personalized Journey</CardTitle>
                    <CardDescription className="text-base">
                      Receive a custom lesson plan with rich, interactive content tailored specifically to your needs and learning preferences.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold">What Learners Say</h2>
            <p className="text-xl text-muted-foreground">
              Join thousands of successful learners
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <CheckCircle key={i} className="h-5 w-5 fill-success text-success" />
                  ))}
                </div>
                <p className="mb-4 italic">
                  "Viveka completely transformed my learning experience. The personalized curriculum helped me grasp complex topics faster than ever."
                </p>
                <p className="font-semibold">Sarah M.</p>
                <p className="text-sm text-muted-foreground">Computer Science Student</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <CheckCircle key={i} className="h-5 w-5 fill-success text-success" />
                  ))}
                </div>
                <p className="mb-4 italic">
                  "The adaptive assessment really understood my strengths and weaknesses. I'm learning at my own pace and actually enjoying it!"
                </p>
                <p className="font-semibold">James L.</p>
                <p className="text-sm text-muted-foreground">Data Science Learner</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <CheckCircle key={i} className="h-5 w-5 fill-success text-success" />
                  ))}
                </div>
                <p className="mb-4 italic">
                  "Finally, a platform that doesn't treat everyone the same. Viveka's personalized approach made all the difference for me."
                </p>
                <p className="font-semibold">Maria G.</p>
                <p className="text-sm text-muted-foreground">Mathematics Enthusiast</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="gradient-hero py-20 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-4xl font-bold">
            Ready to Transform Your Learning?
          </h2>
          <p className="mb-8 text-xl opacity-90">
            Join Viveka today and experience personalized education tailored to you.
          </p>
          <Button size="lg" variant="secondary" className="text-lg" asChild>
            <Link to="/auth">Start Learning Now</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Viveka. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

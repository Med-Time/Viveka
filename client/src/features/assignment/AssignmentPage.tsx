import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { assignmentApi } from "./assignment.api";
import { Question, QuestionFeedback } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function AssignmentPage() {
  const { studyId, level, chapterIdx, subtopicIdx } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; feedback: QuestionFeedback[] } | null>(null);

  // 1. Fetch Questions on Load
  useEffect(() => {
    if (!studyId || !level || !chapterIdx) return;

    const fetchQuiz = async () => {
      try {
        setLoading(true);
        let data;
        
        if (level === "subtopic" && subtopicIdx) {
          data = await assignmentApi.getSubtopicQuiz(studyId, parseInt(chapterIdx), parseInt(subtopicIdx));
        } else if (level === "chapter") {
          data = await assignmentApi.getChapterTest(studyId, parseInt(chapterIdx));
        }
        else if (level === "subject") {
  // We added this API method in the previous step (step 2)
  // If typescript complains, check assignment.api.ts has 'getSubjectCapstone'
  data = await assignmentApi.getSubjectCapstone(studyId);
}

        if (data) {
          setQuestions(data.questions);
          // Pre-fill answers if resuming a completed/partial quiz
          const existingAnswers: Record<string, string> = {};
          data.questions.forEach(q => {
            if (q.user_response) existingAnswers[q.question_id] = q.user_response;
          });
          setAnswers(existingAnswers);
        }
      } catch (error) {
        console.error(error);
        toast({ title: "Error loading quiz", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [studyId, level, chapterIdx, subtopicIdx]);

  // 2. Handle Answer Change
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // 3. Submit Quiz
  const handleSubmit = async () => {
    if (!studyId || !chapterIdx) return;
    
    // Validate all answered? (Optional, maybe just warn)
    if (Object.keys(answers).length < questions.length) {
      toast({ title: "Please answer all questions", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        assignment_level: level as "subtopic" | "chapter" | "subject",
        chapter_idx: parseInt(chapterIdx),
        subtopic_idx: subtopicIdx ? parseInt(subtopicIdx) : undefined,
        responses: Object.entries(answers).map(([qid, ans]) => ({
          question_id: qid,
          user_answer: ans,
        })),
      };

      const response = await assignmentApi.submitAssignment(studyId, payload);
      setResult({
        score: response.overall_score,
        feedback: response.feedback_list,
      });
      toast({ title: "Quiz Submitted!", description: `Score: ${response.overall_score}%` });
      
      // Scroll to top to see results
      window.scrollTo(0, 0);
      
    } catch (error) {
      console.error(error);
      toast({ title: "Submission failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold capitalize">{level} Assignment</h1>
        {result && (
          <div className="text-xl font-bold px-4 py-2 bg-primary/10 rounded-lg">
            Score: {result.score.toFixed(1)}%
          </div>
        )}
      </div>

      {questions.map((q, idx) => {
        // Find feedback for this question if results exist
        const qFeedback = result?.feedback.find(f => f.question_id === q.question_id);
        const isReadOnly = !!result; // Disable inputs if result exists

        return (
          <Card key={q.question_id} className={qFeedback ? (qFeedback.is_correct ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30") : ""}>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex gap-3">
                <span className="opacity-50">{idx + 1}.</span>
                <div className="flex-1">
                  {q.question_text}
                  {qFeedback && (
                    <div className="mt-2 flex items-center gap-2 text-sm font-normal">
                      {qFeedback.is_correct ? (
                        <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Correct</span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1"><XCircle className="w-4 h-4" /> Incorrect</span>
                      )}
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* RENDER BASED ON TYPE */}
              {q.question_type === "mcq" && q.options && (
                <RadioGroup
                  value={answers[q.question_id] || ""}
                  onValueChange={(val) => !isReadOnly && handleAnswerChange(q.question_id, val)}
                  disabled={isReadOnly}
                >
                  {q.options.map((opt) => (
                    <div key={opt.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={opt.id} id={`${q.question_id}-${opt.id}`} />
                      <Label htmlFor={`${q.question_id}-${opt.id}`}>{opt.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {q.question_type === "fill_in_blank" && (
                <Input
                  placeholder="Type your answer..."
                  value={answers[q.question_id] || ""}
                  onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                  disabled={isReadOnly}
                />
              )}

              {q.question_type === "open_ended" && (
                <Textarea
                  placeholder="Write your response here..."
                  value={answers[q.question_id] || ""}
                  onChange={(e) => handleAnswerChange(q.question_id, e.target.value)}
                  disabled={isReadOnly}
                  className="min-h-[100px]"
                />
              )}

              {/* FEEDBACK SECTION */}
              {qFeedback && (
                <div className="mt-4 p-4 bg-muted/50 rounded-md text-sm">
                  <p className="font-semibold">Feedback:</p>
                  <p>{qFeedback.feedback}</p>
                  {!qFeedback.is_correct && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                       <p className="font-semibold text-muted-foreground">Explanation:</p>
                       <p className="text-muted-foreground">{q.explanation}</p>
                    </div>
                  )}
                </div>
              )}

            </CardContent>
          </Card>
        );
      })}

      {!result && (
        <Button onClick={handleSubmit} disabled={submitting} className="w-full md:w-auto" size="lg">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit Assignment
        </Button>
      )}
      
      {result && (
        <Button variant="outline" onClick={() => navigate(-1)} className="w-full md:w-auto">
          Back to Content
        </Button>
      )}
    </div>
  );
}
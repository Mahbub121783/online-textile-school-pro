import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface QuizBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (quiz: any, questions: any[]) => void;
  quiz?: any;
  existingQuestions?: any[];
}

interface Question {
  id?: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  points: number;
}

const emptyQuestion: Question = {
  question_text: '', question_type: 'multiple_choice', options: ['', '', '', ''],
  correct_answer: '', explanation: '', points: 1,
};

const QuizBuilderModal = ({ open, onClose, onSave, quiz, existingQuestions }: QuizBuilderModalProps) => {
  const [info, setInfo] = useState({
    title: quiz?.title || '',
    description: quiz?.description || '',
    time_limit_minutes: quiz?.time_limit_minutes || '',
    pass_percentage: quiz?.pass_percentage || 60,
    max_attempts: quiz?.max_attempts || 3,
    is_published: quiz?.is_published ?? true,
  });

  const [questions, setQuestions] = useState<Question[]>(
    existingQuestions?.map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type || 'multiple_choice',
      options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
      correct_answer: q.correct_answer,
      explanation: q.explanation || '',
      points: q.points || 1,
    })) || []
  );

  const addQuestion = () => setQuestions((p) => [...p, { ...emptyQuestion }]);

  const updateQuestion = (idx: number, field: string, value: any) => {
    setQuestions((p) => p.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((p) => p.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[oIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const removeQuestion = (idx: number) => setQuestions((p) => p.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{quiz ? 'Edit Quiz' : 'Add New Quiz'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info">
          <TabsList className="mb-4">
            <TabsTrigger value="info">Quiz Info</TabsTrigger>
            <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <div className="space-y-2">
              <Label>Quiz Title *</Label>
              <Input value={info.title} onChange={(e) => setInfo((p) => ({ ...p, title: e.target.value }))} placeholder="Enter quiz title" />
            </div>
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea value={info.description} onChange={(e) => setInfo((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Brief description" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Time Limit (min)</Label>
                <Input type="number" value={info.time_limit_minutes} onChange={(e) => setInfo((p) => ({ ...p, time_limit_minutes: e.target.value }))} placeholder="No limit" />
              </div>
              <div className="space-y-2">
                <Label>Passing Grade %</Label>
                <Input type="number" value={info.pass_percentage} onChange={(e) => setInfo((p) => ({ ...p, pass_percentage: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Max Attempts</Label>
                <Input type="number" value={info.max_attempts} onChange={(e) => setInfo((p) => ({ ...p, max_attempts: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={info.is_published} onCheckedChange={(v) => setInfo((p) => ({ ...p, is_published: v }))} />
              <Label className="text-sm">Published (visible to students in the Quizzes dashboard)</Label>
            </div>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4">
            {questions.map((q, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-5 w-5 mt-2 text-muted-foreground shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-2">
                      <Input value={q.question_text} onChange={(e) => updateQuestion(idx, 'question_text', e.target.value)} placeholder={`Question ${idx + 1}`} className="flex-1" />
                      <Select value={q.question_type} onValueChange={(v) => updateQuestion(idx, 'question_type', v)}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                          <SelectItem value="true_false">True / False</SelectItem>
                          <SelectItem value="short_answer">Short Answer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" value={q.points} onChange={(e) => updateQuestion(idx, 'points', Number(e.target.value))} className="w-16" title="Points" />
                    </div>

                    {q.question_type === 'multiple_choice' && (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${idx}`}
                              checked={q.correct_answer === opt && opt !== ''}
                              onChange={() => updateQuestion(idx, 'correct_answer', opt)}
                              className="accent-primary"
                            />
                            <Input value={opt} onChange={(e) => updateOption(idx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} className="h-8 text-sm" />
                          </div>
                        ))}
                      </div>
                    )}

                    {q.question_type === 'true_false' && (
                      <div className="flex gap-4">
                        {['True', 'False'].map((v) => (
                          <label key={v} className="flex items-center gap-2 text-sm">
                            <input type="radio" name={`tf-${idx}`} checked={q.correct_answer === v} onChange={() => updateQuestion(idx, 'correct_answer', v)} className="accent-primary" />
                            {v}
                          </label>
                        ))}
                      </div>
                    )}

                    {q.question_type === 'short_answer' && (
                      <Input value={q.correct_answer} onChange={(e) => updateQuestion(idx, 'correct_answer', e.target.value)} placeholder="Correct answer" className="h-8 text-sm" />
                    )}

                    <Input value={q.explanation} onChange={(e) => updateQuestion(idx, 'explanation', e.target.value)} placeholder="Explanation (optional)" className="h-8 text-xs" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeQuestion(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" className="w-full gap-2" onClick={addQuestion}>
              <Plus className="h-4 w-4" /> Add Question
            </Button>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => { if (!info.title.trim()) return; onSave(info, questions); onClose(); }}>
            {quiz ? 'Update Quiz' : 'Add Quiz'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuizBuilderModal;

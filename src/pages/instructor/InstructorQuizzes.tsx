import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, FileQuestion } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const InstructorQuizzes = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingQuiz, setEditingQuiz] = useState<any>(null);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [quizForm, setQuizForm] = useState({ title: '', description: '', course_id: '', pass_percentage: '60', max_attempts: '3', time_limit_minutes: '' });
  const [questionForm, setQuestionForm] = useState({ question_text: '', question_type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', explanation: '', points: '1' });
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-list', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('instructor_id', user!.id);
      return data ?? [];
    },
  });

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['instructor-quizzes', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const cIds = courses.map((c: any) => c.id);
      if (!cIds.length) return [];
      const { data } = await supabase.from('quizzes').select('*, courses(title), quiz_questions(id)').in('course_id', cIds).order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['quiz-questions-edit', selectedQuizId],
    enabled: !!selectedQuizId,
    queryFn: async () => {
      const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', selectedQuizId!).order('sort_order');
      return data ?? [];
    },
  });

  const saveQuiz = useMutation({
    mutationFn: async () => {
      const payload = {
        title: quizForm.title, description: quizForm.description || null,
        course_id: quizForm.course_id, pass_percentage: Number(quizForm.pass_percentage) || 60,
        max_attempts: Number(quizForm.max_attempts) || 3,
        time_limit_minutes: quizForm.time_limit_minutes ? Number(quizForm.time_limit_minutes) : null,
        is_published: true,
      };
      if (editingQuiz) {
        const { error } = await supabase.from('quizzes').update(payload).eq('id', editingQuiz.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('quizzes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingQuiz ? 'Quiz updated!' : 'Quiz created!' });
      setShowQuizDialog(false);
      setEditingQuiz(null);
      qc.invalidateQueries({ queryKey: ['instructor-quizzes'] });
    },
  });

  const saveQuestion = useMutation({
    mutationFn: async () => {
      const payload = {
        quiz_id: selectedQuizId!,
        question_text: questionForm.question_text,
        question_type: questionForm.question_type,
        options: questionForm.question_type === 'multiple_choice' ? questionForm.options.filter(Boolean) : [],
        correct_answer: questionForm.correct_answer,
        explanation: questionForm.explanation || null,
        points: Number(questionForm.points) || 1,
        sort_order: questions.length,
      };
      if (editingQuestion) {
        const { error } = await supabase.from('quiz_questions').update(payload).eq('id', editingQuestion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('quiz_questions').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingQuestion ? 'Question updated!' : 'Question added!' });
      setShowQuestionDialog(false);
      setEditingQuestion(null);
      setQuestionForm({ question_text: '', question_type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', explanation: '', points: '1' });
      qc.invalidateQueries({ queryKey: ['quiz-questions-edit', selectedQuizId] });
    },
  });

  const deleteQuestion = async (id: string) => {
    await supabase.from('quiz_questions').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['quiz-questions-edit', selectedQuizId] });
  };

  const openEditQuiz = (quiz: any) => {
    setEditingQuiz(quiz);
    setQuizForm({
      title: quiz.title, description: quiz.description || '', course_id: quiz.course_id,
      pass_percentage: String(quiz.pass_percentage), max_attempts: String(quiz.max_attempts),
      time_limit_minutes: quiz.time_limit_minutes ? String(quiz.time_limit_minutes) : '',
    });
    setShowQuizDialog(true);
  };

  const openEditQuestion = (q: any) => {
    setEditingQuestion(q);
    const opts = Array.isArray(q.options) ? q.options : [];
    setQuestionForm({
      question_text: q.question_text, question_type: q.question_type,
      options: [...opts, '', '', '', ''].slice(0, 4),
      correct_answer: q.correct_answer, explanation: q.explanation || '', points: String(q.points),
    });
    setShowQuestionDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold">Quizzes</h2>
        <Button className="bg-accent hover:bg-accent-hover text-accent-foreground gap-2" onClick={() => { setEditingQuiz(null); setQuizForm({ title: '', description: '', course_id: '', pass_percentage: '60', max_attempts: '3', time_limit_minutes: '' }); setShowQuizDialog(true); }}>
          <Plus className="h-4 w-4" /> Create Quiz
        </Button>
      </div>

      {/* Quiz list */}
      {quizzes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileQuestion className="h-16 w-16 mx-auto mb-4 text-muted" />
          <p>No quizzes yet. Create one for your courses!</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {quizzes.map((quiz: any) => (
            <div key={quiz.id} className={`bg-card border rounded-xl p-4 cursor-pointer transition-all ${selectedQuizId === quiz.id ? 'ring-2 ring-primary' : 'hover:shadow-md'}`} onClick={() => setSelectedQuizId(quiz.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-sm">{quiz.title}</h3>
                  <p className="text-xs text-muted-foreground">{quiz.courses?.title} · {quiz.quiz_questions?.length || 0} questions · Pass: {quiz.pass_percentage}%</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditQuiz(quiz); }}><Edit className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Questions for selected quiz */}
      {selectedQuizId && (
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold">Questions</h3>
            <Button size="sm" className="gap-1" onClick={() => { setEditingQuestion(null); setQuestionForm({ question_text: '', question_type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', explanation: '', points: '1' }); setShowQuestionDialog(true); }}>
              <Plus className="h-4 w-4" /> Add Question
            </Button>
          </div>
          {questions.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">No questions yet.</p>
          ) : (
            <div className="space-y-2">
              {questions.map((q: any, i: number) => (
                <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                  <span className="text-xs font-bold text-muted-foreground mt-1">Q{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{q.question_text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{q.question_type}</Badge>
                      <span className="text-xs text-muted-foreground">Answer: {q.correct_answer}</span>
                      <span className="text-xs text-muted-foreground">{q.points}pt</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditQuestion(q)}><Edit className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteQuestion(q.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quiz dialog */}
      <Dialog open={showQuizDialog} onOpenChange={setShowQuizDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingQuiz ? 'Edit Quiz' : 'Create Quiz'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={quizForm.title} onChange={(e) => setQuizForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={quizForm.description} onChange={(e) => setQuizForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select value={quizForm.course_id} onValueChange={(v) => setQuizForm(p => ({ ...p, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Pass %</Label><Input type="number" value={quizForm.pass_percentage} onChange={(e) => setQuizForm(p => ({ ...p, pass_percentage: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Max Attempts</Label><Input type="number" value={quizForm.max_attempts} onChange={(e) => setQuizForm(p => ({ ...p, max_attempts: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Time (min)</Label><Input type="number" value={quizForm.time_limit_minutes} onChange={(e) => setQuizForm(p => ({ ...p, time_limit_minutes: e.target.value }))} placeholder="∞" /></div>
            </div>
            <Button className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => saveQuiz.mutate()} disabled={saveQuiz.isPending || !quizForm.title || !quizForm.course_id}>
              {saveQuiz.isPending ? 'Saving...' : 'Save Quiz'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question dialog */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Question *</Label><Textarea value={questionForm.question_text} onChange={(e) => setQuestionForm(p => ({ ...p, question_text: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={questionForm.question_type} onValueChange={(v) => setQuestionForm(p => ({ ...p, question_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Points</Label><Input type="number" value={questionForm.points} onChange={(e) => setQuestionForm(p => ({ ...p, points: e.target.value }))} /></div>
            </div>
            {questionForm.question_type === 'multiple_choice' && (
              <div className="space-y-2">
                <Label>Options</Label>
                {questionForm.options.map((opt, i) => (
                  <Input key={i} value={opt} onChange={(e) => { const opts = [...questionForm.options]; opts[i] = e.target.value; setQuestionForm(p => ({ ...p, options: opts })); }} placeholder={`Option ${i + 1}`} />
                ))}
              </div>
            )}
            <div className="space-y-2"><Label>Correct Answer *</Label><Input value={questionForm.correct_answer} onChange={(e) => setQuestionForm(p => ({ ...p, correct_answer: e.target.value }))} placeholder={questionForm.question_type === 'true_false' ? 'True or False' : 'Exact answer text'} /></div>
            <div className="space-y-2"><Label>Explanation</Label><Textarea value={questionForm.explanation} onChange={(e) => setQuestionForm(p => ({ ...p, explanation: e.target.value }))} rows={2} placeholder="Why this is the correct answer" /></div>
            <Button className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => saveQuestion.mutate()} disabled={saveQuestion.isPending || !questionForm.question_text || !questionForm.correct_answer}>
              {saveQuestion.isPending ? 'Saving...' : 'Save Question'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstructorQuizzes;

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, GripVertical, Plus, Trash2, Image, CheckSquare, ToggleLeft,
  Type, FileText, ListOrdered, Send, Settings, Clock, ShieldAlert
} from 'lucide-react';
import { useCmsScope } from '@/components/cms/CmsScopeContext';
import { useAuth } from '@/hooks/useAuth';

interface QuestionItem {
  id?: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  points: number;
  negative_marks: number;
  image_url: string;
  is_instruction: boolean;
  sequence_items: string[];
  timer_seconds: number | null;
  sort_order: number;
}

const EMPTY_QUESTION: QuestionItem = {
  question_text: '', question_type: 'multiple_choice', options: ['', '', '', ''],
  correct_answer: '', explanation: '', points: 1, negative_marks: 0, image_url: '',
  is_instruction: false, sequence_items: [], timer_seconds: null, sort_order: 0,
};

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: CheckSquare },
  { value: 'true_false', label: 'True / False', icon: ToggleLeft },
  { value: 'checkbox', label: 'Select (Multi)', icon: CheckSquare },
  { value: 'short_answer', label: 'Short Answer', icon: Type },
  { value: 'instruction', label: 'Instruction Block', icon: FileText },
  { value: 'sequence', label: 'Sequence (Reorder)', icon: ListOrdered },
];

interface Props {
  quizId?: string;
  onBack: () => void;
}

const QuizBuilder = ({ quizId, onBack }: Props) => {
  const qc = useQueryClient();
  const isNew = !quizId;
  const [activeQ, setActiveQ] = useState(0);
  const [questions, setQuestions] = useState<QuestionItem[]>([{ ...EMPTY_QUESTION }]);
  const [showSettings, setShowSettings] = useState(false);
  const [quiz, setQuiz] = useState(() => ({
    title: '', course_id: '', description: '', pass_percentage: 60, max_attempts: 3,
    time_limit_minutes: null as number | null, is_published: false, status: 'draft',
    timer_mode: 'global', anti_cheat_enabled: false, randomize_questions: false,
    randomize_options: false, lock_ip: false, auto_submit_on_blur: false,
  }));
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const { scope, courseId: lockedCourseId } = useCmsScope();
  const { user } = useAuth();
  const isInstructor = scope === 'instructor';

  const { data: courses = [] } = useQuery({
    queryKey: ['quiz-mgmt-courses', scope, user?.id],
    queryFn: async () => {
      let q = supabase.from('courses').select('id, title').order('title');
      if (isInstructor && user?.id) q = q.eq('instructor_id', user.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: existingQuiz } = useQuery({
    queryKey: ['quiz-edit', quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data } = await supabase.from('quizzes').select('*').eq('id', quizId!).single();
      return data;
    },
  });

  const { data: existingQuestions = [] } = useQuery({
    queryKey: ['quiz-edit-questions', quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId!).order('sort_order');
      return data ?? [];
    },
  });

  useEffect(() => {
    if (existingQuiz) {
      setQuiz({
        title: existingQuiz.title, course_id: existingQuiz.course_id,
        description: existingQuiz.description || '', pass_percentage: existingQuiz.pass_percentage || 60,
        max_attempts: existingQuiz.max_attempts || 3,
        time_limit_minutes: existingQuiz.time_limit_minutes,
        is_published: existingQuiz.is_published ?? false, status: (existingQuiz as any).status || 'draft',
        timer_mode: (existingQuiz as any).timer_mode || 'global',
        anti_cheat_enabled: (existingQuiz as any).anti_cheat_enabled ?? false,
        randomize_questions: (existingQuiz as any).randomize_questions ?? false,
        randomize_options: (existingQuiz as any).randomize_options ?? false,
        lock_ip: (existingQuiz as any).lock_ip ?? false,
        auto_submit_on_blur: (existingQuiz as any).auto_submit_on_blur ?? false,
      });
    }
  }, [existingQuiz]);

  useEffect(() => {
    if (existingQuestions.length > 0) {
      setQuestions(existingQuestions.map((q: any) => ({
        id: q.id, question_text: q.question_text, question_type: q.is_instruction ? 'instruction' : q.question_type,
        options: Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : []),
        correct_answer: q.correct_answer || '', explanation: q.explanation || '',
        points: q.points || 1, negative_marks: Number(q.negative_marks) || 0,
        image_url: q.image_url || '', is_instruction: q.is_instruction ?? false,
        sequence_items: Array.isArray(q.sequence_items) ? q.sequence_items : [],
        timer_seconds: q.timer_seconds, sort_order: q.sort_order || 0,
      })));
    }
  }, [existingQuestions]);

  const updateQ = (idx: number, patch: Partial<QuestionItem>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  const addQuestion = (type: string) => {
    const isInstr = type === 'instruction';
    const newQ: QuestionItem = {
      ...EMPTY_QUESTION, question_type: isInstr ? 'short_answer' : type,
      is_instruction: isInstr, sort_order: questions.length,
      options: type === 'true_false' ? ['True', 'False'] : type === 'checkbox' || type === 'multiple_choice' ? ['', '', '', ''] : [],
    };
    setQuestions(prev => [...prev, newQ]);
    setActiveQ(questions.length);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    setActiveQ(Math.min(activeQ, questions.length - 2));
  };

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setQuestions(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(targetIdx, 0, moved);
      return arr.map((q, i) => ({ ...q, sort_order: i }));
    });
    setDragIdx(null);
    setActiveQ(targetIdx);
  };

  const saveQuizMutation = useMutation({
    mutationFn: async () => {
      if (!quiz.title.trim()) throw new Error('Title is required');
      const quizCount = await supabase.from('quizzes').select('id', { count: 'exact', head: true });
      const quizPayload: any = {
        title: quiz.title, course_id: quiz.course_id || null, description: quiz.description,
        pass_percentage: quiz.pass_percentage, max_attempts: quiz.max_attempts,
        time_limit_minutes: quiz.time_limit_minutes, is_published: quiz.is_published,
        status: quiz.status, timer_mode: quiz.timer_mode,
        anti_cheat_enabled: quiz.anti_cheat_enabled, randomize_questions: quiz.randomize_questions,
        randomize_options: quiz.randomize_options, lock_ip: quiz.lock_ip,
        auto_submit_on_blur: quiz.auto_submit_on_blur,
      };
      let savedQuizId = quizId;
      if (isNew) {
        quizPayload.quiz_number = `QUIZ-${String((quizCount.count || 0) + 1).padStart(3, '0')}`;
        const { data, error } = await supabase.from('quizzes').insert(quizPayload).select('id').single();
        if (error) throw error;
        savedQuizId = data.id;
      } else {
        const { error } = await supabase.from('quizzes').update(quizPayload).eq('id', quizId!);
        if (error) throw error;
        await supabase.from('quiz_questions').delete().eq('quiz_id', quizId!);
      }
      const qPayloads = questions.map((q, i) => ({
        quiz_id: savedQuizId!, question_text: q.question_text || (q.is_instruction ? 'Instruction' : 'Question'),
        question_type: q.is_instruction ? 'short_answer' : q.question_type,
        options: q.options, correct_answer: q.correct_answer || 'N/A',
        explanation: q.explanation, points: q.is_instruction ? 0 : q.points,
        negative_marks: q.negative_marks, image_url: q.image_url || null,
        is_instruction: q.is_instruction, sequence_items: q.sequence_items,
        timer_seconds: q.timer_seconds, sort_order: i,
      }));
      if (qPayloads.length > 0) {
        const { error } = await supabase.from('quiz_questions').insert(qPayloads);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-quizzes'] });
      toast.success('Quiz saved successfully!');
      onBack();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const q = questions[activeQ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="font-heading font-bold text-lg flex-1">{isNew ? 'Create New Quiz' : 'Edit Quiz'}</h2>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="h-4 w-4" /> Settings
        </Button>
        <Button size="sm" className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => saveQuizMutation.mutate()} disabled={saveQuizMutation.isPending}>
          <Save className="h-4 w-4" /> {saveQuizMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Quiz basic info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Title</Label>
          <Input value={quiz.title} onChange={e => setQuiz(f => ({ ...f, title: e.target.value }))} className="h-9" placeholder="Quiz title" />
        </div>
        <div>
          <Label className="text-xs">Course</Label>
          <Select value={quiz.course_id || '_independent'} onValueChange={v => setQuiz(f => ({ ...f, course_id: v === '_independent' ? '' : v }))}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_independent">Independent (No Course)</SelectItem>
              {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={quiz.status} onValueChange={v => setQuiz(f => ({ ...f, status: v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Advanced Settings</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label className="text-xs">Pass %</Label><Input type="number" value={quiz.pass_percentage} onChange={e => setQuiz(f => ({ ...f, pass_percentage: Number(e.target.value) }))} className="h-9" /></div>
              <div><Label className="text-xs">Max Attempts</Label><Input type="number" value={quiz.max_attempts} onChange={e => setQuiz(f => ({ ...f, max_attempts: Number(e.target.value) }))} className="h-9" /></div>
              <div><Label className="text-xs">Time (min)</Label><Input type="number" value={quiz.time_limit_minutes ?? ''} onChange={e => setQuiz(f => ({ ...f, time_limit_minutes: e.target.value ? Number(e.target.value) : null }))} className="h-9" placeholder="∞" /></div>
              <div><Label className="text-xs">Timer Mode</Label>
                <Select value={quiz.timer_mode} onValueChange={v => setQuiz(f => ({ ...f, timer_mode: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="global">Global</SelectItem><SelectItem value="per_question">Per Question</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2"><Switch checked={quiz.anti_cheat_enabled} onCheckedChange={v => setQuiz(f => ({ ...f, anti_cheat_enabled: v }))} /><Label className="text-xs">Anti-Cheat (Focus Lock)</Label></div>
              <div className="flex items-center gap-2"><Switch checked={quiz.auto_submit_on_blur} onCheckedChange={v => setQuiz(f => ({ ...f, auto_submit_on_blur: v }))} /><Label className="text-xs">Auto-Submit on Tab Switch</Label></div>
              <div className="flex items-center gap-2"><Switch checked={quiz.lock_ip} onCheckedChange={v => setQuiz(f => ({ ...f, lock_ip: v }))} /><Label className="text-xs">Lock IP Address</Label></div>
              <div className="flex items-center gap-2"><Switch checked={quiz.randomize_questions} onCheckedChange={v => setQuiz(f => ({ ...f, randomize_questions: v }))} /><Label className="text-xs">Randomize Questions</Label></div>
              <div className="flex items-center gap-2"><Switch checked={quiz.randomize_options} onCheckedChange={v => setQuiz(f => ({ ...f, randomize_options: v }))} /><Label className="text-xs">Randomize Options</Label></div>
              <div className="flex items-center gap-2"><Switch checked={quiz.is_published} onCheckedChange={v => setQuiz(f => ({ ...f, is_published: v }))} /><Label className="text-xs">Published</Label></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main builder area */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: question list */}
        <div className="col-span-12 md:col-span-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">Questions ({questions.length})</p>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {questions.map((item, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                onClick={() => setActiveQ(idx)}
                className={`flex items-center gap-1 p-2 rounded-md text-xs cursor-pointer transition-colors ${activeQ === idx ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'}`}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 cursor-grab" />
                <span className="font-mono text-muted-foreground w-5">{idx + 1}</span>
                <span className="truncate flex-1">{item.is_instruction ? '📋 Instruction' : item.question_text || 'Untitled'}</span>
                {questions.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); removeQuestion(idx); }} className="opacity-0 group-hover:opacity-100 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                )}
              </div>
            ))}
          </div>

          {/* Element library */}
          <div className="border-t pt-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-1">Add Element</p>
            {QUESTION_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => addQuestion(t.value)}
                className="flex items-center gap-2 w-full p-2 text-xs rounded-md hover:bg-muted transition-colors text-left"
              >
                <t.icon className="h-3.5 w-3.5 text-primary" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: question editor */}
        <div className="col-span-12 md:col-span-9">
          {q && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    {q.is_instruction ? 'Instruction Block' : q.question_type.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Q{activeQ + 1}</span>
                </div>

                {q.is_instruction ? (
                  <div>
                    <Label className="text-xs">Instruction Content</Label>
                    <Textarea value={q.question_text} onChange={e => updateQ(activeQ, { question_text: e.target.value })} rows={4} placeholder="Enter instruction text, context, or reading material..." />
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="text-xs">Question Text</Label>
                      <Textarea value={q.question_text} onChange={e => updateQ(activeQ, { question_text: e.target.value })} rows={2} placeholder="Enter your question..." />
                    </div>

                    <div>
                      <Label className="text-xs">Image URL (optional)</Label>
                      <Input value={q.image_url} onChange={e => updateQ(activeQ, { image_url: e.target.value })} className="h-9" placeholder="https://..." />
                    </div>

                    {/* Options for MCQ / Checkbox */}
                    {(q.question_type === 'multiple_choice' || q.question_type === 'checkbox') && (
                      <div className="space-y-2">
                        <Label className="text-xs">Options</Label>
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <Input value={opt} onChange={e => {
                              const opts = [...q.options]; opts[oi] = e.target.value;
                              updateQ(activeQ, { options: opts });
                            }} className="h-8 text-sm" placeholder={`Option ${oi + 1}`} />
                            {q.options.length > 2 && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQ(activeQ, { options: q.options.filter((_, i) => i !== oi) })}><Trash2 className="h-3 w-3" /></Button>
                            )}
                          </div>
                        ))}
                        {q.options.length < 6 && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateQ(activeQ, { options: [...q.options, ''] })}><Plus className="h-3 w-3 mr-1" /> Add Option</Button>
                        )}
                      </div>
                    )}

                    {/* Sequence items */}
                    {q.question_type === 'sequence' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Sequence Items (correct order)</Label>
                        {q.sequence_items.map((item, si) => (
                          <div key={si} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-5">{si + 1}.</span>
                            <Input value={item} onChange={e => {
                              const items = [...q.sequence_items]; items[si] = e.target.value;
                              updateQ(activeQ, { sequence_items: items });
                            }} className="h-8 text-sm" placeholder={`Step ${si + 1}`} />
                            {q.sequence_items.length > 2 && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQ(activeQ, { sequence_items: q.sequence_items.filter((_, i) => i !== si) })}><Trash2 className="h-3 w-3" /></Button>
                            )}
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateQ(activeQ, { sequence_items: [...q.sequence_items, ''] })}><Plus className="h-3 w-3 mr-1" /> Add Step</Button>
                      </div>
                    )}

                    {/* Correct answer */}
                    <div>
                      <Label className="text-xs">Correct Answer</Label>
                      {q.question_type === 'true_false' ? (
                        <Select value={q.correct_answer} onValueChange={v => updateQ(activeQ, { correct_answer: v })}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent><SelectItem value="True">True</SelectItem><SelectItem value="False">False</SelectItem></SelectContent>
                        </Select>
                      ) : q.question_type === 'multiple_choice' ? (
                        <Select value={q.correct_answer} onValueChange={v => updateQ(activeQ, { correct_answer: v })}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select correct option" /></SelectTrigger>
                          <SelectContent>{q.options.filter(Boolean).map((o, i) => <SelectItem key={i} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : q.question_type === 'checkbox' ? (
                        <Input value={q.correct_answer} onChange={e => updateQ(activeQ, { correct_answer: e.target.value })} className="h-9" placeholder="Comma-separated correct answers" />
                      ) : q.question_type === 'sequence' ? (
                        <p className="text-xs text-muted-foreground mt-1">Correct order is the order defined above. Answer auto-checked.</p>
                      ) : (
                        <Input value={q.correct_answer} onChange={e => updateQ(activeQ, { correct_answer: e.target.value })} className="h-9" placeholder="Expected answer" />
                      )}
                    </div>

                    {/* Scoring */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><Label className="text-xs">Points</Label><Input type="number" value={q.points} onChange={e => updateQ(activeQ, { points: Number(e.target.value) })} className="h-9" /></div>
                      <div>
                        <Label className="text-xs">Negative Marks</Label>
                        <Select value={String(q.negative_marks)} onValueChange={v => updateQ(activeQ, { negative_marks: Number(v) })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">None (0)</SelectItem>
                            <SelectItem value="0.25">-0.25</SelectItem>
                            <SelectItem value="0.5">-0.50</SelectItem>
                            <SelectItem value="1">-1</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {quiz.timer_mode === 'per_question' && (
                        <div><Label className="text-xs">Timer (sec)</Label><Input type="number" value={q.timer_seconds ?? ''} onChange={e => updateQ(activeQ, { timer_seconds: e.target.value ? Number(e.target.value) : null })} className="h-9" placeholder="∞" /></div>
                      )}
                    </div>

                    <div>
                      <Label className="text-xs">Explanation (shown after submit)</Label>
                      <Input value={q.explanation} onChange={e => updateQ(activeQ, { explanation: e.target.value })} className="h-9" placeholder="Why this is the correct answer..." />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizBuilder;

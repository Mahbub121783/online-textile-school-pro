import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { toast } from 'sonner';
import { Search, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Settings2 } from 'lucide-react';

interface Weights {
  quiz: number;
  assignment: number;
  manual: number;
}

const DEFAULT_WEIGHTS: Weights = { quiz: 40, assignment: 40, manual: 20 };

const GradebookTab = () => {
  const [courseFilter, setCourseFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [manualDialog, setManualDialog] = useState<{ open: boolean; userId?: string; courseId?: string; mark?: any }>({ open: false });
  const [manualForm, setManualForm] = useState({ label: 'Participation', score: '0', max_score: '100', notes: '' });
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const qc = useQueryClient();

  // Load weights from site_settings for the selected course
  const { data: savedWeights } = useQuery({
    queryKey: ['gradebook-weights', courseFilter],
    queryFn: async () => {
      if (courseFilter === 'all') return null;
      const { data } = await supabase.from('site_settings').select('value').eq('key', `gradebook_weights_${courseFilter}`).maybeSingle();
      return data?.value ? JSON.parse(data.value) as Weights : null;
    },
  });

  useEffect(() => {
    if (savedWeights) {
      setWeights(savedWeights);
    } else {
      setWeights(DEFAULT_WEIGHTS);
    }
  }, [savedWeights, courseFilter]);

  const saveWeights = useMutation({
    mutationFn: async (w: Weights) => {
      if (courseFilter === 'all') return;
      const key = `gradebook_weights_${courseFilter}`;
      // Upsert
      const { data: existing } = await supabase.from('site_settings').select('id').eq('key', key).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('site_settings').update({ value: JSON.stringify(w) }).eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('site_settings').insert({ key, value: JSON.stringify(w) });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gradebook-weights'] });
      toast.success('Weights saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const adjustWeight = (field: keyof Weights, value: number) => {
    // Ensure total is always 100 by adjusting the other two proportionally
    const others = Object.keys(weights).filter(k => k !== field) as (keyof Weights)[];
    const remaining = 100 - value;
    const otherSum = others.reduce((s, k) => s + weights[k], 0);
    const newWeights = { ...weights, [field]: value };
    if (otherSum > 0) {
      others.forEach(k => {
        newWeights[k] = Math.round((weights[k] / otherSum) * remaining);
      });
      // Fix rounding
      const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
      if (total !== 100) {
        newWeights[others[0]] += 100 - total;
      }
    } else {
      // Split evenly
      others.forEach((k, i) => {
        newWeights[k] = Math.round(remaining / others.length) + (i === 0 ? remaining % others.length : 0);
      });
    }
    setWeights(newWeights);
  };

  const { data: courses = [] } = useQuery({
    queryKey: ['gradebook-courses'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').order('title');
      return data ?? [];
    },
  });

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['gradebook-enrollments', courseFilter, search],
    queryFn: async () => {
      let q = supabase.from('enrollments').select('*, user_profiles!enrollments_user_id_fkey(full_name, avatar_url), courses!enrollments_course_id_fkey(title)').order('enrolled_at', { ascending: false });
      if (courseFilter !== 'all') q = q.eq('course_id', courseFilter);
      const { data } = await q;
      let results = data ?? [];
      if (search) results = results.filter((e: any) => e.user_profiles?.full_name?.toLowerCase().includes(search.toLowerCase()));
      return results;
    },
  });

  const { data: quizAttempts = [] } = useQuery({
    queryKey: ['gradebook-quiz-attempts', courseFilter],
    queryFn: async () => {
      let q = supabase.from('quiz_attempts').select('*, quizzes!quiz_attempts_quiz_id_fkey(course_id, title)');
      if (courseFilter !== 'all') q = q.eq('quizzes.course_id', courseFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['gradebook-submissions', courseFilter],
    queryFn: async () => {
      let q = supabase.from('assignment_submissions').select('*, assignments!assignment_submissions_assignment_id_fkey(course_id, title, max_score)');
      if (courseFilter !== 'all') q = q.eq('assignments.course_id', courseFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: manualMarks = [] } = useQuery({
    queryKey: ['gradebook-manual-marks', courseFilter],
    queryFn: async () => {
      let q = supabase.from('gradebook_manual_marks').select('*');
      if (courseFilter !== 'all') q = q.eq('course_id', courseFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const saveManualMark = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('gradebook_manual_marks').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('gradebook_manual_marks').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gradebook-manual-marks'] });
      setManualDialog({ open: false });
      toast.success('Manual mark saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteManualMark = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gradebook_manual_marks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gradebook-manual-marks'] }); toast.success('Mark deleted'); },
  });

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getStudentQuizzes = (userId: string, courseId: string) =>
    quizAttempts.filter((a: any) => a.user_id === userId && a.quizzes?.course_id === courseId);

  const getStudentSubmissions = (userId: string, courseId: string) =>
    submissions.filter((s: any) => s.user_id === userId && s.assignments?.course_id === courseId);

  const getStudentManualMarks = (userId: string, courseId: string) =>
    manualMarks.filter((m: any) => m.user_id === userId && m.course_id === courseId);

  const calcWeighted = (userId: string, courseId: string) => {
    const quizzes = getStudentQuizzes(userId, courseId);
    const assigns = getStudentSubmissions(userId, courseId);
    const marks = getStudentManualMarks(userId, courseId);

    const qw = weights.quiz / 100;
    const aw = weights.assignment / 100;
    const mw = weights.manual / 100;

    let quizPct = 0;
    if (quizzes.length > 0) {
      quizPct = quizzes.reduce((s: number, a: any) => s + (Number(a.percentage) || 0), 0) / quizzes.length;
    }

    let assignPct = 0;
    const gradedAssigns = assigns.filter((s: any) => s.score != null);
    if (gradedAssigns.length > 0) {
      assignPct = gradedAssigns.reduce((s: number, a: any) => {
        const max = a.assignments?.max_score || 100;
        return s + ((a.score / max) * 100);
      }, 0) / gradedAssigns.length;
    }

    let manualPct = 0;
    if (marks.length > 0) {
      manualPct = marks.reduce((s: number, m: any) => s + ((Number(m.score) / Number(m.max_score || 100)) * 100), 0) / marks.length;
    }

    let totalWeight = 0;
    let totalScore = 0;
    if (quizzes.length > 0) { totalWeight += qw; totalScore += quizPct * qw; }
    if (gradedAssigns.length > 0) { totalWeight += aw; totalScore += assignPct * aw; }
    if (marks.length > 0) { totalWeight += mw; totalScore += manualPct * mw; }

    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    return { quizPct: Math.round(quizPct), assignPct: Math.round(assignPct), manualPct: Math.round(manualPct), finalScore, hasData: totalWeight > 0 };
  };

  const gradeColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  const openManualMark = (userId: string, courseId: string, mark?: any) => {
    if (mark) {
      setManualForm({ label: mark.label, score: String(mark.score), max_score: String(mark.max_score), notes: mark.notes || '' });
    } else {
      setManualForm({ label: 'Participation', score: '0', max_score: '100', notes: '' });
    }
    setManualDialog({ open: true, userId, courseId, mark });
  };

  const handleSaveManual = () => {
    if (!manualForm.label.trim()) return toast.error('Label required');
    const payload: any = {
      user_id: manualDialog.userId,
      course_id: manualDialog.courseId,
      label: manualForm.label,
      score: parseFloat(manualForm.score) || 0,
      max_score: parseFloat(manualForm.max_score) || 100,
      notes: manualForm.notes || null,
    };
    if (manualDialog.mark) payload.id = manualDialog.mark.id;
    saveManualMark.mutate(payload);
  };

  return (
    <div className="space-y-4">
      {/* Weight Configuration */}
      <Collapsible open={weightsOpen} onOpenChange={setWeightsOpen}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Weights:</span>
            <Badge variant="outline" className="text-[10px]">Quiz {weights.quiz}%</Badge>
            <Badge variant="outline" className="text-[10px]">Assignment {weights.assignment}%</Badge>
            <Badge variant="outline" className="text-[10px]">Manual {weights.manual}%</Badge>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Configure Weights
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="p-4 space-y-4">
              {courseFilter === 'all' ? (
                <p className="text-sm text-muted-foreground text-center py-2">Select a specific course to configure weights.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Adjust the weight distribution for grade calculation. Total must equal 100%.</p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Quiz Weight</Label>
                        <span className="text-sm font-semibold text-primary">{weights.quiz}%</span>
                      </div>
                      <Slider
                        value={[weights.quiz]}
                        onValueChange={([v]) => adjustWeight('quiz', v)}
                        min={0} max={100} step={5}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Assignment Weight</Label>
                        <span className="text-sm font-semibold text-primary">{weights.assignment}%</span>
                      </div>
                      <Slider
                        value={[weights.assignment]}
                        onValueChange={([v]) => adjustWeight('assignment', v)}
                        min={0} max={100} step={5}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Manual Weight</Label>
                        <span className="text-sm font-semibold text-primary">{weights.manual}%</span>
                      </div>
                      <Slider
                        value={[weights.manual]}
                        onValueChange={([v]) => adjustWeight('manual', v)}
                        min={0} max={100} step={5}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Total: {weights.quiz + weights.assignment + weights.manual}%</span>
                      {weights.quiz + weights.assignment + weights.manual !== 100 && (
                        <Badge variant="destructive" className="text-[10px]">Must equal 100%</Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setWeights(DEFAULT_WEIGHTS)}>Reset</Button>
                      <Button size="sm" className="text-xs bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => saveWeights.mutate(weights)} disabled={saveWeights.isPending || weights.quiz + weights.assignment + weights.manual !== 100}>
                        {saveWeights.isPending ? 'Saving...' : 'Save Weights'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-48 h-9"><SelectValue placeholder="All Courses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Quiz Avg</TableHead>
                <TableHead>Assignment Avg</TableHead>
                <TableHead>Manual Avg</TableHead>
                <TableHead>Final Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : enrollments.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No enrollments found.</TableCell></TableRow>
              ) : enrollments.map((e: any) => {
                const scores = calcWeighted(e.user_id, e.course_id);
                const isOpen = expanded.has(e.id);
                const studentQuizzes = getStudentQuizzes(e.user_id, e.course_id);
                const studentAssigns = getStudentSubmissions(e.user_id, e.course_id);
                const studentMarks = getStudentManualMarks(e.user_id, e.course_id);

                return (
                  <React.Fragment key={e.id}>
                    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(e.id)}>
                      <TableCell className="w-8 pl-3">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{e.user_profiles?.full_name || 'Unknown'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[180px]">{e.courses?.title || '—'}</TableCell>
                      <TableCell className="text-sm">{scores.quizPct > 0 ? `${scores.quizPct}%` : '—'}</TableCell>
                      <TableCell className="text-sm">{scores.assignPct > 0 ? `${scores.assignPct}%` : '—'}</TableCell>
                      <TableCell className="text-sm">{scores.manualPct > 0 ? `${scores.manualPct}%` : '—'}</TableCell>
                      <TableCell>
                        {scores.hasData ? (
                          <Badge className={`text-xs ${gradeColor(scores.finalScore)}`}>{scores.finalScore}/100</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="font-semibold mb-1">Quiz Scores <span className="font-normal text-muted-foreground">({weights.quiz}% weight)</span></p>
                              {studentQuizzes.length === 0 ? <p className="text-muted-foreground">No attempts</p> : (
                                <div className="space-y-1">
                                  {studentQuizzes.map((a: any) => (
                                    <div key={a.id} className="flex justify-between">
                                      <span className="truncate">{a.quizzes?.title || 'Quiz'}</span>
                                      <span className="font-mono">{a.score}/{a.total_points} ({Math.round(Number(a.percentage))}%)</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold mb-1">Assignment Scores <span className="font-normal text-muted-foreground">({weights.assignment}% weight)</span></p>
                              {studentAssigns.length === 0 ? <p className="text-muted-foreground">No submissions</p> : (
                                <div className="space-y-1">
                                  {studentAssigns.map((s: any) => (
                                    <div key={s.id} className="flex justify-between">
                                      <span className="truncate">{s.assignments?.title || 'Assignment'}</span>
                                      <span className="font-mono">{s.score != null ? `${s.score}/${s.assignments?.max_score || 100}` : 'Pending'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold">Manual Marks <span className="font-normal text-muted-foreground">({weights.manual}% weight)</span></p>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(ev) => { ev.stopPropagation(); openManualMark(e.user_id, e.course_id); }}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              {studentMarks.length === 0 ? <p className="text-muted-foreground">No marks</p> : (
                                <div className="space-y-1">
                                  {studentMarks.map((m: any) => (
                                    <div key={m.id} className="flex items-center justify-between">
                                      <span className="truncate">{m.label}</span>
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono">{m.score}/{m.max_score}</span>
                                        <button onClick={(ev) => { ev.stopPropagation(); openManualMark(e.user_id, e.course_id, m); }} className="hover:text-primary"><Pencil className="h-3 w-3" /></button>
                                        <button onClick={(ev) => { ev.stopPropagation(); deleteManualMark.mutate(m.id); }} className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manual Mark Dialog */}
      <Dialog open={manualDialog.open} onOpenChange={o => setManualDialog({ ...manualDialog, open: o })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{manualDialog.mark ? 'Edit Manual Mark' : 'Add Manual Mark'}</DialogTitle>
            <DialogDescription>Enter a manual performance mark.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={manualForm.label} onChange={e => setManualForm(f => ({ ...f, label: e.target.value }))} className="h-9" placeholder="e.g. Participation" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Score</Label>
                <Input type="number" value={manualForm.score} onChange={e => setManualForm(f => ({ ...f, score: e.target.value }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Max Score</Label>
                <Input type="number" value={manualForm.max_score} onChange={e => setManualForm(f => ({ ...f, max_score: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} className="h-9" />
            </div>
            <Button onClick={handleSaveManual} className="w-full bg-accent hover:bg-accent-hover text-accent-foreground" disabled={saveManualMark.isPending}>
              {saveManualMark.isPending ? 'Saving...' : 'Save Mark'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GradebookTab;

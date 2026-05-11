import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import LiveSessionsTab from './question-bank/LiveSessionsTab';
import ViolationsTab from './question-bank/ViolationsTab';
import BadgesTab from './question-bank/BadgesTab';
import AnalyticsTab from './question-bank/AnalyticsTab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Sparkles, Upload, Brain, Loader2, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Diff = 'basic' | 'intermediate' | 'advanced';
type QType = 'multiple_choice' | 'true_false' | 'short_answer';

const emptyQ = { subject_id: '', topic_id: '', difficulty: 'basic' as Diff, question_type: 'multiple_choice' as QType, question_text: '', options: ['', '', '', ''], correct_answer: '', explanation: '', points: 1, is_active: true };

const AdminQuestionBank = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const VALID = ['subjects', 'questions', 'bulk', 'ai', 'sessions', 'violations', 'badges', 'analytics', 'ai-settings'];
  const tab = tabParam && VALID.includes(tabParam) ? tabParam : 'subjects';
  const setTab = (v: string) => navigate(`/admin/question-bank/${v}`);

  // ---- KPI strip ----
  const { data: kpi } = useQuery({
    queryKey: ['admin-qb-kpi'],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 86400_000).toISOString();
      const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [qs, exams7d, viol24h, live] = await Promise.all([
        supabase.from('qb_questions').select('id', { count: 'exact', head: true }),
        supabase.from('qb_exam_sessions').select('id', { count: 'exact', head: true }).gte('started_at', since7d),
        supabase.from('qb_exam_violations').select('id', { count: 'exact', head: true }).gte('occurred_at', since24h),
        supabase.from('qb_exam_sessions').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      ]);
      return {
        questions: qs.count ?? 0,
        exams7d: exams7d.count ?? 0,
        violations24h: viol24h.count ?? 0,
        live: live.count ?? 0,
      };
    },
    refetchInterval: 30_000,
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ['admin-qb-subjects'],
    queryFn: async () => (await supabase.from('qb_subjects').select('*').order('sort_order')).data ?? [],
  });
  const [subjectModal, setSubjectModal] = useState<any>(null);

  const saveSubject = useMutation({
    mutationFn: async (s: any) => {
      const payload = { name: s.name, slug: s.slug, description: s.description, icon: s.icon, color: s.color, sort_order: s.sort_order || 0, is_active: s.is_active ?? true };
      if (s.id) {
        const { error } = await supabase.from('qb_subjects').update(payload).eq('id', s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('qb_subjects').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-qb-subjects'] }); setSubjectModal(null); toast({ title: 'Saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('qb_subjects').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-qb-subjects'] }); toast({ title: 'Deleted' }); },
  });

  // ---- Questions ----
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterDiff, setFilterDiff] = useState<string>('all');
  const [questionModal, setQuestionModal] = useState<any>(null);

  const { data: questions = [], isLoading: qLoading } = useQuery({
    queryKey: ['admin-qb-questions', filterSubject, filterDiff],
    queryFn: async () => {
      let q = supabase.from('qb_questions').select('*, qb_subjects(name)').order('created_at', { ascending: false }).limit(500);
      if (filterSubject !== 'all') q = q.eq('subject_id', filterSubject);
      if (filterDiff !== 'all') q = q.eq('difficulty', filterDiff as Diff);
      const { data } = await q;
      return data ?? [];
    },
  });

  const saveQuestion = useMutation({
    mutationFn: async (q: any) => {
      const payload: any = {
        subject_id: q.subject_id, topic_id: q.topic_id || null, difficulty: q.difficulty,
        question_type: q.question_type, question_text: q.question_text,
        options: q.question_type === 'multiple_choice' ? q.options.filter((o: string) => o.trim()) : [],
        correct_answer: q.correct_answer, explanation: q.explanation, points: q.points || 1, is_active: q.is_active,
      };
      if (q.id) {
        const { error } = await supabase.from('qb_questions').update(payload).eq('id', q.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('qb_questions').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-qb-questions'] }); setQuestionModal(null); toast({ title: 'Saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('qb_questions').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-qb-questions'] }); toast({ title: 'Deleted' }); },
  });

  // ---- Bulk import ----
  const [bulkText, setBulkText] = useState('');
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const handleBulkImport = async () => {
    if (!bulkSubject) { toast({ title: 'Pick a subject', variant: 'destructive' }); return; }
    setBulkBusy(true);
    try {
      const lines = bulkText.trim().split('\n').filter((l, i) => l.trim() && i > 0);
      const rows = lines.map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        return {
          subject_id: bulkSubject,
          difficulty: (cols[0] || 'basic') as Diff,
          question_type: 'multiple_choice' as QType,
          question_text: cols[1] || '',
          options: [cols[2], cols[3], cols[4], cols[5]].filter(Boolean),
          correct_answer: cols[6] || '',
          explanation: cols[7] || '',
          points: parseInt(cols[8] || '1', 10),
          source: 'bulk' as const,
        };
      }).filter((r) => r.question_text && r.correct_answer);

      if (rows.length === 0) { toast({ title: 'No valid rows', variant: 'destructive' }); setBulkBusy(false); return; }

      // batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('qb_questions').insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
      toast({ title: `Imported ${rows.length} questions` });
      setBulkText('');
      qc.invalidateQueries({ queryKey: ['admin-qb-questions'] });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    }
    setBulkBusy(false);
  };

  const downloadTemplate = () => {
    const csv = 'difficulty,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,points\nbasic,"What is 2+2?",2,3,4,5,4,"Simple addition",1\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'qb-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ---- AI generator ----
  const [aiSubject, setAiSubject] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiDiff, setAiDiff] = useState<Diff>('basic');
  const [aiCount, setAiCount] = useState(10);
  const [aiLang, setAiLang] = useState<'en' | 'bn'>('en');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDrafts, setAiDrafts] = useState<any[]>([]);

  const generateAI = async (testMode = false) => {
    if (!aiSubject) { toast({ title: 'Subject required', variant: 'destructive' }); return; }
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('qb-ai-generate', {
        body: { subject_id: aiSubject, topic: aiTopic || undefined, difficulty: aiDiff, count: aiCount, language: aiLang, test: testMode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiDrafts(data?.questions || []);
      const provNote = data?.fallback_used ? ` (fallback: ${data.provider_used})` : ` via ${data?.provider_used}`;
      toast({ title: `Generated ${data?.questions?.length || 0} drafts${provNote}` });
    } catch (e: any) {
      toast({ title: 'AI generation failed', description: e.message, variant: 'destructive' });
    }
    setAiBusy(false);
  };

  // ---- AI settings ----
  const { data: aiSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['qb-ai-settings'],
    queryFn: async () => (await supabase.from('qb_ai_settings').select('*').limit(1).maybeSingle()).data,
  });
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const currentSettings = settingsForm ?? aiSettings ?? { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.7, fallback_enabled: true, fallback_provider: 'lovable', fallback_model: 'google/gemini-2.5-flash', max_questions_per_run: 25, system_prompt_override: '' };

  const saveSettings = async () => {
    const payload = {
      provider: currentSettings.provider,
      model: currentSettings.model,
      temperature: Number(currentSettings.temperature) || 0.7,
      fallback_enabled: !!currentSettings.fallback_enabled,
      fallback_provider: currentSettings.fallback_provider,
      fallback_model: currentSettings.fallback_model,
      max_questions_per_run: Number(currentSettings.max_questions_per_run) || 25,
      system_prompt_override: currentSettings.system_prompt_override || null,
    };
    const { error } = aiSettings?.id
      ? await supabase.from('qb_ai_settings').update(payload).eq('id', aiSettings.id)
      : await supabase.from('qb_ai_settings').insert(payload);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'AI settings saved' });
    setSettingsForm(null);
    refetchSettings();
  };

  const PROVIDER_HINTS: Record<string, string> = {
    groq: 'llama-3.3-70b-versatile (free, fast)',
    mistral: 'mistral-small-latest (free tier)',
    openrouter: 'google/gemini-2.0-flash-exp:free or meta-llama/llama-3.3-70b-instruct:free',
    openai: 'gpt-4o-mini',
    lovable: 'google/gemini-2.5-flash',
  };

  const approveAllDrafts = async () => {
    if (aiDrafts.length === 0) return;
    const rows = aiDrafts.map((d) => ({
      subject_id: aiSubject, difficulty: aiDiff, question_type: 'multiple_choice' as QType,
      question_text: d.question_text, options: d.options, correct_answer: d.correct_answer,
      explanation: d.explanation, points: 1, source: 'ai' as const,
    }));
    const { error } = await supabase.from('qb_questions').insert(rows);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Added ${rows.length} questions` });
    setAiDrafts([]);
    qc.invalidateQueries({ queryKey: ['admin-qb-questions'] });
  };

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" /> Question Bank</h2>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
          <TabsTrigger value="ai">AI Generate</TabsTrigger>
          <TabsTrigger value="ai-settings">AI Settings</TabsTrigger>
        </TabsList>

        {/* SUBJECTS */}
        <TabsContent value="subjects" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setSubjectModal({ name: '', slug: '', sort_order: 0, is_active: true })}><Plus className="h-4 w-4 mr-1" /> Add Subject</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjects.map((s: any) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">{s.icon || '🧠'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.slug}</p>
                  </div>
                  {s.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Hidden</Badge>}
                  <Button size="icon" variant="ghost" onClick={() => setSubjectModal(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm('Delete this subject and all its questions?')) deleteSubject.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* QUESTIONS */}
        <TabsContent value="questions" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDiff} onValueChange={setFilterDiff}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button onClick={() => setQuestionModal({ ...emptyQ, subject_id: filterSubject !== 'all' ? filterSubject : (subjects[0]?.id || '') })}><Plus className="h-4 w-4 mr-1" /> Add Question</Button>
          </div>

          {qLoading ? <p className="text-muted-foreground py-8 text-center animate-pulse">Loading...</p> : (
            <div className="space-y-2">
              {questions.map((q: any) => (
                <Card key={q.id}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <Badge variant="outline" className="capitalize shrink-0">{q.difficulty}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {q.qb_subjects?.name} • {q.question_type} • {q.times_used} uses • {Math.round(Number(q.correct_rate))}% correct
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setQuestionModal({ ...q, options: Array.isArray(q.options) ? q.options : [] })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm('Delete this question?')) deleteQuestion.mutate(q.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </CardContent>
                </Card>
              ))}
              {questions.length === 0 && <p className="text-muted-foreground py-8 text-center">No questions yet.</p>}
            </div>
          )}
        </TabsContent>

        {/* BULK IMPORT */}
        <TabsContent value="bulk" className="space-y-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Select value={bulkSubject} onValueChange={setBulkSubject}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Pick subject for import" /></SelectTrigger>
                <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" /> CSV Template</Button>
            </div>
            <Label>Paste CSV (header row required: difficulty,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,points)</Label>
            <Textarea rows={12} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="difficulty,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,points" className="font-mono text-xs" />
            <Button onClick={handleBulkImport} disabled={bulkBusy || !bulkText.trim()}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />} Import
            </Button>
          </CardContent></Card>
        </TabsContent>

        {/* AI GENERATE */}
        <TabsContent value="ai" className="space-y-3">
          <Card><CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Subject</Label>
                <Select value={aiSubject} onValueChange={setAiSubject}>
                  <SelectTrigger><SelectValue placeholder="Pick subject" /></SelectTrigger>
                  <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Topic / Lesson</Label>
                <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Newton's Laws" />
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select value={aiDiff} onValueChange={(v) => setAiDiff(v as Diff)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Count</Label>
                <Input type="number" value={aiCount} onChange={(e) => setAiCount(parseInt(e.target.value) || 5)} min={1} max={50} />
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="w-40">
                <Label>Language</Label>
                <Select value={aiLang} onValueChange={(v) => setAiLang(v as 'en' | 'bn')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="bn">Bengali</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => generateAI(false)} disabled={aiBusy}>
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />} Generate Drafts
              </Button>
            </div>

            {aiDrafts.length > 0 && (
              <>
                <div className="flex items-center justify-between pt-3 border-t">
                  <p className="font-bold">{aiDrafts.length} drafts ready</p>
                  <Button onClick={approveAllDrafts}><Plus className="h-4 w-4 mr-1" /> Add All to Bank</Button>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {aiDrafts.map((d, i) => (
                    <Card key={i}><CardContent className="p-3 text-sm space-y-1">
                      <p className="font-medium">{i + 1}. {d.question_text}</p>
                      <ul className="text-xs text-muted-foreground ml-4 list-disc">
                        {d.options?.map((o: string, j: number) => (
                          <li key={j} className={o === d.correct_answer ? 'text-emerald-600 font-bold' : ''}>{o}</li>
                        ))}
                      </ul>
                      {d.explanation && <p className="text-xs italic text-muted-foreground">💡 {d.explanation}</p>}
                    </CardContent></Card>
                  ))}
                </div>
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* AI SETTINGS */}
        <TabsContent value="ai-settings" className="space-y-3">
          <Card><CardContent className="p-4 space-y-4">
            <div>
              <h3 className="font-bold text-lg">AI Provider Configuration</h3>
              <p className="text-xs text-muted-foreground">Choose your own AI API key as primary. Lovable AI is optional fallback. API keys are added via Supabase secrets, never stored in the database.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Primary Provider</Label>
                <Select value={currentSettings.provider} onValueChange={(v) => setSettingsForm({ ...currentSettings, provider: v, model: PROVIDER_HINTS[v]?.split(' ')[0] || currentSettings.model })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="groq">Groq (free, recommended)</SelectItem>
                    <SelectItem value="mistral">Mistral</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="lovable">Lovable AI</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Suggested: {PROVIDER_HINTS[currentSettings.provider]}</p>
              </div>
              <div>
                <Label>Primary Model</Label>
                <Input value={currentSettings.model} onChange={(e) => setSettingsForm({ ...currentSettings, model: e.target.value })} />
              </div>
              <div>
                <Label>Temperature ({currentSettings.temperature})</Label>
                <Input type="number" step="0.1" min={0} max={2} value={currentSettings.temperature} onChange={(e) => setSettingsForm({ ...currentSettings, temperature: e.target.value })} />
              </div>
              <div>
                <Label>Max questions per run</Label>
                <Input type="number" min={1} max={50} value={currentSettings.max_questions_per_run} onChange={(e) => setSettingsForm({ ...currentSettings, max_questions_per_run: e.target.value })} />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={!!currentSettings.fallback_enabled} onCheckedChange={(v) => setSettingsForm({ ...currentSettings, fallback_enabled: v })} />
                <Label>Enable fallback if primary fails</Label>
              </div>
              {currentSettings.fallback_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Fallback Provider</Label>
                    <Select value={currentSettings.fallback_provider} onValueChange={(v) => setSettingsForm({ ...currentSettings, fallback_provider: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lovable">Lovable AI</SelectItem>
                        <SelectItem value="groq">Groq</SelectItem>
                        <SelectItem value="mistral">Mistral</SelectItem>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fallback Model</Label>
                    <Input value={currentSettings.fallback_model} onChange={(e) => setSettingsForm({ ...currentSettings, fallback_model: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Custom System Prompt (optional)</Label>
              <Textarea rows={4} value={currentSettings.system_prompt_override || ''} onChange={(e) => setSettingsForm({ ...currentSettings, system_prompt_override: e.target.value })} placeholder="Leave empty to use default prompt" />
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button onClick={saveSettings} disabled={!settingsForm}>Save Settings</Button>
              <Button variant="outline" onClick={() => setSettingsForm(null)} disabled={!settingsForm}>Reset</Button>
              <div className="flex-1" />
              <Button variant="secondary" onClick={async () => {
                if (!aiSubject) { toast({ title: 'Pick a subject in AI Generate tab first', variant: 'destructive' }); return; }
                await generateAI(true);
              }} disabled={aiBusy}>
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Test Connection (1 question)
              </Button>
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <p className="font-bold">Required secrets per provider (add via Supabase → Edge Function secrets):</p>
              <ul className="list-disc ml-5 space-y-0.5">
                <li><code>GROQ_API_KEY</code> — get from console.groq.com/keys (free)</li>
                <li><code>MISTRAL_API_KEY</code> — get from console.mistral.ai</li>
                <li><code>OPENROUTER_API_KEY</code> — get from openrouter.ai/keys (free models available)</li>
                <li><code>OPENAI_API_KEY</code> — get from platform.openai.com/api-keys</li>
                <li><code>LOVABLE_API_KEY</code> — already configured (used as fallback)</li>
              </ul>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Subject modal */}
      <Dialog open={!!subjectModal} onOpenChange={(o) => !o && setSubjectModal(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{subjectModal?.id ? 'Edit Subject' : 'New Subject'}</DialogTitle></DialogHeader>
          {subjectModal && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={subjectModal.name || ''} onChange={(e) => setSubjectModal({ ...subjectModal, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={subjectModal.slug || ''} onChange={(e) => setSubjectModal({ ...subjectModal, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></div>
              <div><Label>Description</Label><Textarea value={subjectModal.description || ''} onChange={(e) => setSubjectModal({ ...subjectModal, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Icon (emoji)</Label><Input value={subjectModal.icon || ''} onChange={(e) => setSubjectModal({ ...subjectModal, icon: e.target.value })} placeholder="🧠" /></div>
                <div><Label>Color (hex)</Label><Input value={subjectModal.color || ''} onChange={(e) => setSubjectModal({ ...subjectModal, color: e.target.value })} placeholder="#0ea5e9" /></div>
                <div><Label>Sort</Label><Input type="number" value={subjectModal.sort_order || 0} onChange={(e) => setSubjectModal({ ...subjectModal, sort_order: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={subjectModal.is_active ?? true} onCheckedChange={(v) => setSubjectModal({ ...subjectModal, is_active: v })} /><Label>Active</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectModal(null)}>Cancel</Button>
            <Button onClick={() => saveSubject.mutate(subjectModal)} disabled={saveSubject.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question modal */}
      <Dialog open={!!questionModal} onOpenChange={(o) => !o && setQuestionModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{questionModal?.id ? 'Edit Question' : 'New Question'}</DialogTitle></DialogHeader>
          {questionModal && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Subject</Label>
                  <Select value={questionModal.subject_id} onValueChange={(v) => setQuestionModal({ ...questionModal, subject_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                    <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Difficulty</Label>
                  <Select value={questionModal.difficulty} onValueChange={(v) => setQuestionModal({ ...questionModal, difficulty: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={questionModal.question_type} onValueChange={(v) => setQuestionModal({ ...questionModal, question_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="short_answer">Short Answer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Question</Label><Textarea rows={3} value={questionModal.question_text} onChange={(e) => setQuestionModal({ ...questionModal, question_text: e.target.value })} /></div>

              {questionModal.question_type === 'multiple_choice' && (
                <div className="space-y-2">
                  <Label>Options (click to mark correct)</Label>
                  {questionModal.options.map((opt: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" checked={questionModal.correct_answer === opt && opt !== ''} onChange={() => setQuestionModal({ ...questionModal, correct_answer: opt })} />
                      <Input value={opt} onChange={(e) => {
                        const opts = [...questionModal.options]; opts[i] = e.target.value;
                        setQuestionModal({ ...questionModal, options: opts, correct_answer: questionModal.correct_answer === questionModal.options[i] ? e.target.value : questionModal.correct_answer });
                      }} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                    </div>
                  ))}
                </div>
              )}

              {questionModal.question_type === 'true_false' && (
                <div>
                  <Label>Correct Answer</Label>
                  <Select value={questionModal.correct_answer} onValueChange={(v) => setQuestionModal({ ...questionModal, correct_answer: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                    <SelectContent><SelectItem value="True">True</SelectItem><SelectItem value="False">False</SelectItem></SelectContent>
                  </Select>
                </div>
              )}

              {questionModal.question_type === 'short_answer' && (
                <div><Label>Correct Answer</Label><Input value={questionModal.correct_answer} onChange={(e) => setQuestionModal({ ...questionModal, correct_answer: e.target.value })} /></div>
              )}

              <div><Label>Explanation</Label><Textarea rows={2} value={questionModal.explanation || ''} onChange={(e) => setQuestionModal({ ...questionModal, explanation: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Points</Label><Input type="number" value={questionModal.points || 1} onChange={(e) => setQuestionModal({ ...questionModal, points: parseInt(e.target.value) || 1 })} /></div>
                <div className="flex items-center gap-2 mt-6"><Switch checked={questionModal.is_active ?? true} onCheckedChange={(v) => setQuestionModal({ ...questionModal, is_active: v })} /><Label>Active</Label></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionModal(null)}>Cancel</Button>
            <Button onClick={() => saveQuestion.mutate(questionModal)} disabled={saveQuestion.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminQuestionBank;

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Brain, Zap, Flame, Lock, Play, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import SEOHead from '@/components/SEOHead';

const DIFFICULTY_META = {
  basic: { label: 'Basic', icon: Brain, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900', mins: 20, desc: 'Foundation level. Perfect to warm up.' },
  intermediate: { label: 'Intermediate', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900', mins: 25, desc: 'Mixed difficulty. Tests applied knowledge.' },
  advanced: { label: 'Advanced', icon: Flame, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-900', mins: 30, desc: 'Challenging. For mastery seekers.' },
} as const;

type Diff = keyof typeof DIFFICULTY_META;

const PracticeSubject = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [starting, setStarting] = useState<Diff | null>(null);

  const { data: subject, isLoading } = useQuery({
    queryKey: ['qb-subject', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.from('qb_subjects').select('*').eq('slug', slug!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['qb-topics', subject?.id],
    enabled: !!subject?.id,
    queryFn: async () => {
      const { data } = await supabase.from('qb_topics').select('*').eq('subject_id', subject!.id).eq('is_active', true).order('sort_order');
      return data ?? [];
    },
  });

  const { data: counts = { basic: 0, intermediate: 0, advanced: 0 } } = useQuery({
    queryKey: ['qb-subject-counts', subject?.id, selectedTopic],
    enabled: !!subject?.id,
    staleTime: 30 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // 3 cheap head-counts instead of pulling every question row.
      const baseFilter = (qb: any) => {
        let q = qb.eq('subject_id', subject!.id).eq('is_active', true);
        if (selectedTopic) q = q.eq('topic_id', selectedTopic);
        return q;
      };
      const [b, i, a] = await Promise.all([
        baseFilter(supabase.from('qb_questions').select('id', { count: 'exact', head: true })).eq('difficulty', 'basic'),
        baseFilter(supabase.from('qb_questions').select('id', { count: 'exact', head: true })).eq('difficulty', 'intermediate'),
        baseFilter(supabase.from('qb_questions').select('id', { count: 'exact', head: true })).eq('difficulty', 'advanced'),
      ]);
      return { basic: b.count ?? 0, intermediate: i.count ?? 0, advanced: a.count ?? 0 };
    },
  });

  const startExam = async (difficulty: Diff) => {
    if (!user) {
      toast({ title: 'Please sign in', description: 'You need to sign in to start an exam.', variant: 'destructive' });
      navigate('/auth/login');
      return;
    }
    setStarting(difficulty);
    try {
      const { data, error } = await supabase.rpc('qb_start_exam', {
        _subject_id: subject!.id,
        _difficulty: difficulty,
        _topic_id: selectedTopic,
        _question_count: 25,
      });
      if (error) throw error;
      const sessionId = (data as any).session_id;
      navigate(`/practice/exam/${sessionId}`);
    } catch (e: any) {
      toast({ title: 'Could not start exam', description: e.message || 'Try again later.', variant: 'destructive' });
    } finally {
      setStarting(null);
    }
  };

  if (isLoading) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground animate-pulse">Loading...</div>;
  if (!subject) return <div className="container mx-auto px-4 py-20 text-center"><p>Subject not found.</p><Button asChild className="mt-4"><Link to="/practice">Back</Link></Button></div>;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={`${subject.name} — Practice Exam`} description={subject.description ?? `Practice exams for ${subject.name}`} />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/practice"><ArrowLeft className="h-4 w-4 mr-1" /> All Subjects</Link>
        </Button>

        <div className="flex items-start gap-4 mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: subject.color ? `${subject.color}20` : 'hsl(var(--primary)/0.1)', color: subject.color || 'hsl(var(--primary))' }}
          >
            {subject.icon || '🧠'}
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold">{subject.name}</h1>
            {subject.description && <p className="text-muted-foreground mt-1">{subject.description}</p>}
          </div>
        </div>

        {topics.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium mb-2">Filter by Topic (optional)</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={selectedTopic === null ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedTopic(null)}>All Topics</Badge>
              {topics.map((t: any) => (
                <Badge key={t.id} variant={selectedTopic === t.id ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedTopic(t.id)}>{t.name}</Badge>
              ))}
            </div>
          </div>
        )}

        <h2 className="font-heading text-xl font-bold mb-3">Choose Difficulty</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(DIFFICULTY_META) as Diff[]).map((d) => {
            const meta = DIFFICULTY_META[d];
            const Icon = meta.icon;
            const available = counts[d];
            const enough = available >= 1;
            return (
              <Card key={d} className={`border-2 ${meta.border} ${meta.bg} relative overflow-hidden`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-background flex items-center justify-center ${meta.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary">{available} Q</Badge>
                  </div>
                  <h3 className={`font-heading font-bold text-lg ${meta.color}`}>{meta.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">{meta.desc}</p>
                  <ul className="text-xs space-y-1 mb-4 text-muted-foreground">
                    <li>• 25 random questions</li>
                    <li>• {meta.mins} min time limit</li>
                    <li>• Pass mark 60%</li>
                  </ul>
                  <Button
                    className="w-full gap-2"
                    disabled={!enough || starting !== null}
                    onClick={() => startExam(d)}
                  >
                    {starting === d ? <Loader2 className="h-4 w-4 animate-spin" /> : enough ? <Play className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {enough ? 'Start Exam' : 'Not enough questions'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PracticeSubject;

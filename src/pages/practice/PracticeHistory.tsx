import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, History as HistoryIcon, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const PracticeHistory = () => {
  const { user } = useAuth();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['qb-history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qb_exam_sessions')
        .select('*, qb_subjects(name, slug, icon, color)')
        .eq('user_id', user!.id)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/practice"><ArrowLeft className="h-4 w-4 mr-1" /> Practice Hub</Link>
        </Button>
        <div className="flex items-center gap-3 mb-6">
          <HistoryIcon className="h-7 w-7 text-primary" />
          <h1 className="font-heading text-3xl font-bold">Exam History</h1>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground py-12 text-center animate-pulse">Loading...</div>
        ) : sessions.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <p>No exam attempts yet.</p>
            <Button asChild className="mt-4"><Link to="/practice">Take your first exam</Link></Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {sessions.map((s: any) => (
              <Card key={s.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: s.qb_subjects?.color ? `${s.qb_subjects.color}20` : 'hsl(var(--primary)/0.1)' }}
                  >
                    {s.qb_subjects?.icon || '🧠'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold truncate">{s.qb_subjects?.name || 'Unknown'}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] capitalize">{s.difficulty}</Badge>
                      <span>{format(new Date(s.submitted_at), 'MMM d, yyyy h:mm a')}</span>
                      <span>• {Math.floor(s.time_taken_seconds / 60)}m {s.time_taken_seconds % 60}s</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {s.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                      <span className={`font-bold text-lg ${s.passed ? 'text-emerald-600' : 'text-rose-600'}`}>{Math.round(Number(s.percentage))}%</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{s.score}/{s.total_points} pts</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/practice/result/${s.id}`}><Eye className="h-3.5 w-3.5 mr-1" /> View</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeHistory;

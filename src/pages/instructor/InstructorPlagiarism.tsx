import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, Clock, Search, RefreshCw, Settings2, ShieldAlert, Play } from 'lucide-react';
import { toast } from 'sonner';

const InstructorPlagiarism = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [threshold, setThreshold] = useState(30);

  // Instructor's courses
  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-plag', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').eq('instructor_id', user!.id).order('title');
      return data ?? [];
    },
  });

  const courseIds = courses.map((c: any) => c.id);

  // Plagiarism reports for instructor's courses only
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['instructor-plagiarism', statusFilter, courseFilter, courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from('plagiarism_reports')
        .select(`
          *,
          assignment_submissions!inner(
            id, user_id, assignment_id, submission_text,
            assignments!inner(title, course_id, courses!inner(title, instructor_id))
          )
        `)
        .in('assignment_submissions.assignments.course_id', courseIds)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data } = await q;

      let results = (data ?? []).filter((r: any) => r.assignment_submissions?.assignments?.courses?.instructor_id === user!.id);
      if (courseFilter !== 'all') {
        results = results.filter((r: any) => r.assignment_submissions?.assignments?.course_id === courseFilter);
      }
      return results;
    },
  });

  // Unchecked submissions
  const { data: uncheckedSubs = [] } = useQuery({
    queryKey: ['unchecked-submissions', courseIds],
    enabled: courseIds.length > 0,
    queryFn: async () => {
      const { data: assigns } = await supabase.from('assignments').select('id').in('course_id', courseIds);
      if (!assigns?.length) return [];
      const assignIds = assigns.map(a => a.id);
      const { data: subs } = await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, user_id, submission_text')
        .in('assignment_id', assignIds)
        .not('submission_text', 'is', null);

      // Filter out already checked
      const { data: existingReports } = await supabase.from('plagiarism_reports').select('submission_id');
      const checkedIds = new Set((existingReports ?? []).map((r: any) => r.submission_id));
      return (subs ?? []).filter((s: any) => !checkedIds.has(s.id));
    },
  });

  const userIds = [...new Set(reports.map((r: any) => r.assignment_submissions?.user_id).filter(Boolean))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-plag-inst', userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.full_name]));

  const runCheckMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const { data: submission } = await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, submission_text, user_id')
        .eq('id', submissionId)
        .single();

      if (!submission?.submission_text) throw new Error('No submission text to check');

      const { data: others } = await supabase
        .from('assignment_submissions')
        .select('id, submission_text, user_id')
        .eq('assignment_id', submission.assignment_id)
        .neq('id', submissionId)
        .not('submission_text', 'is', null);

      const getShingles = (text: string, k = 3) => {
        const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        const shingles = new Set<string>();
        for (let i = 0; i <= words.length - k; i++) {
          shingles.add(words.slice(i, i + k).join(' '));
        }
        return shingles;
      };

      const sourceShingles = getShingles(submission.submission_text);
      let maxSimilarity = 0;
      const matchedSources: any[] = [];

      for (const other of (others ?? [])) {
        if (!other.submission_text) continue;
        const otherShingles = getShingles(other.submission_text);
        const intersection = new Set([...sourceShingles].filter(x => otherShingles.has(x)));
        const union = new Set([...sourceShingles, ...otherShingles]);
        const similarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0;
        if (similarity > 5) {
          matchedSources.push({ submission_id: other.id, user_id: other.user_id, similarity_pct: Math.round(similarity * 10) / 10 });
        }
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      const similarityPct = Math.round(maxSimilarity * 10) / 10;

      const { error } = await supabase.from('plagiarism_reports').upsert({
        submission_id: submissionId,
        similarity_pct: similarityPct,
        matched_sources: matchedSources,
        status: similarityPct >= threshold ? 'flagged' : 'clean',
        checked_at: new Date().toISOString(),
      }, { onConflict: 'submission_id' });

      if (error) {
        await supabase.from('plagiarism_reports').insert({
          submission_id: submissionId,
          similarity_pct: similarityPct,
          matched_sources: matchedSources,
          status: similarityPct >= threshold ? 'flagged' : 'clean',
          checked_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-plagiarism'] });
      queryClient.invalidateQueries({ queryKey: ['unchecked-submissions'] });
      toast.success('Plagiarism check completed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkCheckMutation = useMutation({
    mutationFn: async () => {
      for (const sub of uncheckedSubs) {
        await runCheckMutation.mutateAsync(sub.id);
      }
    },
    onSuccess: () => toast.success(`Checked ${uncheckedSubs.length} submissions`),
  });

  const getSeverityBadge = (pct: number) => {
    if (pct >= 50) return <Badge variant="destructive" className="text-[10px]">{pct}%</Badge>;
    if (pct >= 30) return <Badge className="text-[10px] bg-amber-500">{pct}%</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{pct}%</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'flagged': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'clean': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" /> Plagiarism Checker
          </h1>
          <p className="text-sm text-muted-foreground">Check assignment submissions for similarity across your courses</p>
        </div>
        {uncheckedSubs.length > 0 && (
          <Button onClick={() => bulkCheckMutation.mutate()} disabled={bulkCheckMutation.isPending} className="gap-1.5">
            <Play className="h-4 w-4" />
            {bulkCheckMutation.isPending ? 'Checking...' : `Check ${uncheckedSubs.length} New Submissions`}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Course:</Label>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="clean">Clean</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm">Threshold:</Label>
          <Input type="number" className="w-20" value={threshold} onChange={e => setThreshold(Number(e.target.value))} min={0} max={100} />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Similarity</TableHead>
                <TableHead>Matches</TableHead>
                <TableHead>Checked</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 animate-pulse text-muted-foreground">Loading...</TableCell></TableRow>
              ) : reports.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 text-muted" />
                  No plagiarism reports yet. Click "Check New Submissions" to start.
                </TableCell></TableRow>
              ) : (
                reports.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{getStatusIcon(r.status)}</TableCell>
                    <TableCell className="font-medium text-sm">{profileMap[r.assignment_submissions?.user_id] || 'Unknown'}</TableCell>
                    <TableCell className="text-sm">{r.assignment_submissions?.assignments?.title || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.assignment_submissions?.assignments?.courses?.title || '—'}</TableCell>
                    <TableCell>{getSeverityBadge(Number(r.similarity_pct))}</TableCell>
                    <TableCell className="text-sm">{Array.isArray(r.matched_sources) ? r.matched_sources.length : 0} source(s)</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.checked_at ? new Date(r.checked_at).toLocaleDateString() : 'Not checked'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => runCheckMutation.mutate(r.submission_id)} disabled={runCheckMutation.isPending}>
                        <RefreshCw className="h-3.5 w-3.5" /> Re-check
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstructorPlagiarism;

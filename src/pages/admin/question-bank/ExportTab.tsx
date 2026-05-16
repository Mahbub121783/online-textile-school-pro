import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const escapeCsv = (v: any): string => {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join(' | ') : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const ExportTab = () => {
  const [subjectId, setSubjectId] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [exported, setExported] = useState<number | null>(null);

  const { data: subjects = [] } = useQuery({
    queryKey: ['qb-export-subjects'],
    queryFn: async () => {
      const { data } = await supabase.from('qb_subjects').select('id, name, is_active').order('sort_order');
      return data ?? [];
    },
  });

  const exportCsv = async () => {
    setBusy(true);
    setExported(null);
    try {
      const PAGE = 1000;
      let from = 0;
      const all: any[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from('qb_questions')
          .select('subject_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, source, is_active, qb_subjects!qb_questions_subject_id_fkey(name)')
          .range(from, from + PAGE - 1);
        if (subjectId !== 'all') q = q.eq('subject_id', subjectId);
        if (difficulty !== 'all') q = q.eq('difficulty', difficulty as any);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      if (all.length === 0) {
        toast({ title: 'No questions match the filters' });
        setBusy(false);
        return;
      }

      const header = ['subject_name', 'difficulty', 'question_type', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'correct_answer', 'explanation', 'points', 'source', 'is_active'];
      const lines = [header.join(',')];
      for (const r of all) {
        const opts: string[] = Array.isArray(r.options) ? r.options : [];
        const row = [
          (r as any).qb_subjects?.name ?? '',
          r.difficulty,
          r.question_type,
          r.question_text,
          opts[0] ?? '',
          opts[1] ?? '',
          opts[2] ?? '',
          opts[3] ?? '',
          opts[4] ?? '',
          opts[5] ?? '',
          r.correct_answer,
          r.explanation ?? '',
          r.points,
          r.source ?? '',
          r.is_active,
        ].map(escapeCsv);
        lines.push(row.join(','));
      }
      const csv = '\uFEFF' + lines.join('\n'); // BOM for Excel UTF-8
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `question-bank-export-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExported(all.length);
      toast({ title: `Exported ${all.length} questions` });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Bulk Export Questions
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Download all question-bank data as a CSV (opens directly in Excel / Google Sheets).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Department</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments (active + archived)</SelectItem>
                {subjects.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{!s.is_active && ' (archived)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All difficulties</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={exportCsv} disabled={busy} size="lg" className="w-full sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Download CSV
        </Button>

        {exported !== null && (
          <p className="text-xs text-emerald-600 font-medium">✓ Last export: {exported} rows</p>
        )}

        <div className="text-[11px] text-muted-foreground border-t pt-3">
          <strong>Columns:</strong> subject_name · difficulty · question_type · question_text · option_a–f · correct_answer · explanation · points · source · is_active
        </div>
      </CardContent>
    </Card>
  );
};

export default ExportTab;

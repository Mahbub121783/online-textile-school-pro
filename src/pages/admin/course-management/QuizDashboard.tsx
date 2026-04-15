import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Pencil, BarChart3, Clock, Users, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const PAGE_SIZE = 24;

interface Props {
  onCreateNew: () => void;
  onEdit: (quizId: string) => void;
  onResults: (quizId: string) => void;
}

const QuizDashboard = ({ onCreateNew, onEdit, onResults }: Props) => {
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);

  const { data: courses = [] } = useQuery({
    queryKey: ['quiz-mgmt-courses'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title').order('title');
      return data ?? [];
    },
  });

  const { data: quizResult, isLoading } = useQuery({
    queryKey: ['admin-quizzes', courseFilter, search, statusFilter, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from('quizzes')
        .select('*, courses!quizzes_course_id_fkey(title)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (courseFilter !== 'all') q = q.eq('course_id', courseFilter);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (search) q = q.ilike('title', `%${search}%`);
      const { data, count } = await q;
      return { quizzes: data ?? [], total: count ?? 0 };
    },
  });

  const quizzes = quizResult?.quizzes ?? [];
  const totalCount = quizResult?.total ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const { data: questionCounts = {} } = useQuery({
    queryKey: ['quiz-question-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('quiz_questions').select('quiz_id').eq('is_instruction', false).limit(5000);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { counts[r.quiz_id] = (counts[r.quiz_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: attemptCounts = {} } = useQuery({
    queryKey: ['quiz-attempt-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('quiz_attempts').select('quiz_id').limit(5000);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { counts[r.quiz_id] = (counts[r.quiz_id] || 0) + 1; });
      return counts;
    },
  });

  const statusColor = (s: string) => {
    if (s === 'live') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (s === 'ended') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  };

  // Reset page when filters change
  const handleSearch = (val: string) => { setSearch(val); setPage(0); };
  const handleCourseFilter = (val: string) => { setCourseFilter(val); setPage(0); };
  const handleStatusFilter = (val: string) => { setStatusFilter(val); setPage(0); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search quizzes..." value={search} onChange={e => handleSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={courseFilter} onValueChange={handleCourseFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Courses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground shrink-0" onClick={onCreateNew}>
          <Plus className="h-4 w-4" /> Create New Quiz
        </Button>
      </div>

      {/* Count badge */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-xs">{totalCount} quizzes</Badge>
        {totalPages > 1 && <span>Page {page + 1} of {totalPages}</span>}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading quizzes...</div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No quizzes found. Create your first quiz!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {quizzes.map((quiz: any) => (
              <Card key={quiz.id} className="hover:shadow-md transition-shadow group">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono text-muted-foreground">{quiz.quiz_number || 'QUIZ-???'}</p>
                      <h3 className="font-heading font-semibold text-sm truncate mt-0.5">{quiz.title}</h3>
                      <p className="text-xs text-muted-foreground truncate">{quiz.courses?.title || <Badge variant="outline" className="text-[10px]">Independent</Badge>}</p>
                    </div>
                    <Badge className={`text-[10px] px-1.5 py-0.5 capitalize shrink-0 ${statusColor(quiz.status || 'draft')}`}>
                      {quiz.status || 'draft'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3" />{questionCounts[quiz.id] || 0} Qs</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{quiz.time_limit_minutes ? `${quiz.time_limit_minutes}m` : '∞'}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{attemptCounts[quiz.id] || 0}</span>
                  </div>

                  <div className="flex items-center gap-1 pt-1 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onEdit(quiz.id)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onResults(quiz.id)}>
                      <BarChart3 className="h-3 w-3" /> Results
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i;
                  } else if (page < 3) {
                    pageNum = i;
                  } else if (page > totalPages - 4) {
                    pageNum = totalPages - 7 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QuizDashboard;

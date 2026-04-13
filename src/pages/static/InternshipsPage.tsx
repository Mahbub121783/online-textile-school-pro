import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Briefcase, Clock, DollarSign, MapPin, Send, Search } from 'lucide-react';
import { toast } from 'sonner';

const InternshipsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedInternship, setSelectedInternship] = useState<any>(null);
  const [applyForm, setApplyForm] = useState({ cover_letter: '', resume_url: '' });

  const { data: internships = [], isLoading } = useQuery({
    queryKey: ['public-internships'],
    queryFn: async () => {
      const { data } = await supabase
        .from('internships')
        .select('*')
        .eq('is_published', true)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  // Get user's existing applications
  const { data: myApps = [] } = useQuery({
    queryKey: ['my-internship-apps', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('internship_applications')
        .select('internship_id, status')
        .eq('user_id', user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const appliedMap = Object.fromEntries(myApps.map((a: any) => [a.internship_id, a.status]));

  const applyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('internship_applications').insert({
        internship_id: selectedInternship.id,
        user_id: user!.id,
        cover_letter: applyForm.cover_letter || null,
        resume_url: applyForm.resume_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-internship-apps'] });
      setApplyOpen(false);
      setApplyForm({ cover_letter: '', resume_url: '' });
      toast.success('Application submitted!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = internships.filter((i: any) =>
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold mb-2">Internship Opportunities</h1>
          <p className="text-muted-foreground">Find and apply for internships in the textile industry</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search internships..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground animate-pulse">Loading internships...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 mx-auto mb-3 text-muted" />
            <p className="text-muted-foreground">No internships available at the moment.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((i: any) => {
              const appStatus = appliedMap[i.id];
              return (
                <Card key={i.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-heading font-bold text-lg">{i.title}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5" /> {i.company}
                        </p>
                        {i.description && <p className="text-sm mt-3 line-clamp-3">{i.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-3">
                          {i.stipend && (
                            <span className="text-xs flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="h-3 w-3" /> {i.stipend}
                            </span>
                          )}
                          {i.duration && (
                            <span className="text-xs flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" /> {i.duration}
                            </span>
                          )}
                          {i.application_deadline && (
                            <span className="text-xs text-muted-foreground">
                              Deadline: {new Date(i.application_deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        {appStatus ? (
                          <Badge variant="outline" className="capitalize">{appStatus}</Badge>
                        ) : user ? (
                          <Button size="sm" className="gap-1" onClick={() => { setSelectedInternship(i); setApplyOpen(true); }}>
                            <Send className="h-3.5 w-3.5" /> Apply
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" asChild>
                            <a href="/auth/login">Login to Apply</a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />

      {/* Apply Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Apply — {selectedInternship?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Cover Letter</Label><Textarea value={applyForm.cover_letter} onChange={e => setApplyForm(p => ({ ...p, cover_letter: e.target.value }))} rows={4} placeholder="Why are you interested..." /></div>
            <div><Label>Resume URL</Label><Input value={applyForm.resume_url} onChange={e => setApplyForm(p => ({ ...p, resume_url: e.target.value }))} placeholder="https://drive.google.com/..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InternshipsPage;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFileUpload } from '@/hooks/useFileUpload';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Upload, Plus, X, FileText, Check, Loader2, Save } from 'lucide-react';

interface CoAuthor {
  name: string;
  affiliation: string;
  email: string;
}

const STEPS = ['Paper Details', 'Co-Authors', 'Upload File', 'Review & Submit'];

const ResearchSubmit = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { upload, uploading, progress } = useFileUpload();
  const [step, setStep] = useState(0);
  const [paperId, setPaperId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    abstract: '',
    category: '',
    keywords: '',
  });
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');

  // Load draft if editing
  const { data: existingDrafts = [] } = useQuery({
    queryKey: ['my-draft-papers', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('research_papers')
        .select('*')
        .eq('submitted_by', user!.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const authors = [
        { name: profile?.full_name || 'Author', affiliation: '', email: user?.email || '' },
        ...coAuthors.filter(a => a.name.trim()),
      ];
      const payload = {
        title: form.title,
        abstract: form.abstract || null,
        category: form.category || null,
        keywords: form.keywords || null,
        authors,
        file_url: fileUrl || null,
        submitted_by: user!.id,
        status: 'draft' as const,
      };

      if (paperId) {
        const { error } = await supabase.from('research_papers').update(payload).eq('id', paperId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('research_papers').insert(payload).select('id').single();
        if (error) throw error;
        setPaperId(data.id);
      }
    },
    onSuccess: () => toast.success('Draft saved!'),
    onError: (e: any) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const authors = [
        { name: profile?.full_name || 'Author', affiliation: '', email: user?.email || '' },
        ...coAuthors.filter(a => a.name.trim()),
      ];
      const payload = {
        title: form.title,
        abstract: form.abstract || null,
        category: form.category || null,
        keywords: form.keywords || null,
        authors,
        file_url: fileUrl || null,
        submitted_by: user!.id,
        status: 'submitted' as const,
      };

      if (paperId) {
        const { error } = await supabase.from('research_papers').update(payload).eq('id', paperId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('research_papers').insert(payload);
        if (error) throw error;
      }

      // Notify admins
      await supabase.rpc('notify_admins', {
        _type: 'research',
        _title: 'New Research Paper Submitted',
        _message: `"${form.title}" has been submitted for review.`,
        _link: '/admin/research-papers',
      });
    },
    onSuccess: () => {
      toast.success('Paper submitted for review!');
      navigate('/dashboard/my-research');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are accepted');
      return;
    }
    try {
      const result = await upload(file, { forceR2: true });
      setFileUrl(result.url);
      setFileName(file.name);
      toast.success('File uploaded successfully!');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    }
  };

  const addCoAuthor = () => setCoAuthors(prev => [...prev, { name: '', affiliation: '', email: '' }]);
  const removeCoAuthor = (i: number) => setCoAuthors(prev => prev.filter((_, idx) => idx !== i));
  const updateCoAuthor = (i: number, field: keyof CoAuthor, value: string) => {
    setCoAuthors(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  };

  const canProceed = () => {
    if (step === 0) return form.title.trim().length > 0;
    if (step === 2) return !!fileUrl;
    return true;
  };

  if (!user) {
    navigate('/auth/login');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/research')} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <h1 className="font-heading text-2xl font-bold mb-2">Submit Research Paper</h1>
        <p className="text-sm text-muted-foreground mb-6">Share your research with the academic community</p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{STEPS[step]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <>
                <div>
                  <Label>Paper Title *</Label>
                  <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Enter your research paper title" />
                </div>
                <div>
                  <Label>Abstract</Label>
                  <Textarea value={form.abstract} onChange={e => setForm(p => ({ ...p, abstract: e.target.value }))}
                    rows={6} placeholder="Provide a brief summary of your research..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      placeholder="e.g., Textile Engineering" />
                  </div>
                  <div>
                    <Label>Keywords</Label>
                    <Input value={form.keywords} onChange={e => setForm(p => ({ ...p, keywords: e.target.value }))}
                      placeholder="fiber, weaving, dyeing" />
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="text-sm text-muted-foreground">
                  You ({profile?.full_name}) are automatically listed as the primary author.
                  Add co-authors below.
                </p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm">{profile?.full_name} (You)</p>
                  <p className="text-xs text-muted-foreground">Primary Author</p>
                </div>
                {coAuthors.map((a, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Co-Author {i + 1}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCoAuthor(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Name" value={a.name} onChange={e => updateCoAuthor(i, 'name', e.target.value)} />
                      <Input placeholder="Affiliation" value={a.affiliation} onChange={e => updateCoAuthor(i, 'affiliation', e.target.value)} />
                      <Input placeholder="Email" value={a.email} onChange={e => updateCoAuthor(i, 'email', e.target.value)} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCoAuthor} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Co-Author
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-sm text-muted-foreground">Upload your paper as a PDF file. Max file size: 50MB.</p>
                {fileUrl ? (
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{fileName}</p>
                      <p className="text-xs text-muted-foreground">Uploaded successfully</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setFileUrl(''); setFileName(''); }}>
                      Replace
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    {uploading ? (
                      <div className="space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <Progress value={progress} className="max-w-xs mx-auto" />
                        <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm font-medium mb-1">Drop your PDF here or click to browse</p>
                        <p className="text-xs text-muted-foreground mb-3">Only .pdf files accepted</p>
                        <label>
                          <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                          <Button variant="outline" asChild><span>Choose File</span></Button>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-heading font-semibold">{form.title}</h3>
                  {form.abstract && <p className="text-sm text-muted-foreground line-clamp-4">{form.abstract}</p>}
                  <div className="flex flex-wrap gap-2">
                    {form.category && <Badge variant="outline">{form.category}</Badge>}
                    {form.keywords && form.keywords.split(',').map((k, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{k.trim()}</Badge>
                    ))}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Authors: </span>
                    {profile?.full_name}
                    {coAuthors.filter(a => a.name.trim()).map(a => `, ${a.name}`).join('')}
                  </div>
                  {fileUrl && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <FileText className="h-4 w-4" /> {fileName}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  By submitting, your paper will be reviewed by our editorial team. You will be notified of the decision.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Previous
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => saveDraftMutation.mutate()} disabled={!form.title || saveDraftMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save Draft
            </Button>
          </div>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="gap-1">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !fileUrl} className="gap-1">
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Submit Paper
            </Button>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResearchSubmit;

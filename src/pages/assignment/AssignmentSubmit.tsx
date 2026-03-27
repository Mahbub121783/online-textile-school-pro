import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, CheckCircle2, MessageSquare, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';

const DRIVE_URL_REGEX = /^https:\/\/(drive|docs)\.google\.com\/.+/i;
const DRIVE_FILE_ID_REGEX = /\/file\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/;

function isDriveUrl(url: string) {
  return DRIVE_URL_REGEX.test(url.trim());
}

function isValidDriveFormat(url: string) {
  return isDriveUrl(url) && DRIVE_FILE_ID_REGEX.test(url);
}

const AssignmentSubmit = () => {
  const { assignmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [driveLink, setDriveLink] = useState('');
  const [linkStatus, setLinkStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [linkError, setLinkError] = useState('');

  const { data: assignment } = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: async () => {
      const { data } = await supabase.from('assignments').select('*, courses(title)').eq('id', assignmentId!).single();
      return data;
    },
    enabled: !!assignmentId,
  });

  const { data: submission } = useQuery({
    queryKey: ['submission', assignmentId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', assignmentId!)
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!assignmentId && !!user,
  });

  // Pre-fill from existing submission
  useEffect(() => {
    if (submission) {
      setText(submission.submission_text || '');
      setDriveLink(submission.file_url || '');
      if (submission.file_url && isDriveUrl(submission.file_url)) {
        setLinkStatus('valid');
      }
    }
  }, [submission]);

  const validateDriveLink = async (url: string): Promise<boolean> => {
    if (!url.trim()) return true; // optional
    setLinkStatus('checking');
    setLinkError('');
    try {
      const { data, error } = await supabase.functions.invoke('validate-drive-link', {
        body: { url: url.trim() },
      });
      if (error) throw error;
      if (data?.valid) {
        setLinkStatus('valid');
        return true;
      } else {
        setLinkStatus('invalid');
        setLinkError(data?.error || 'Invalid link');
        return false;
      }
    } catch (e: any) {
      setLinkStatus('invalid');
      setLinkError(e.message || 'Failed to validate link');
      return false;
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Validate drive link if provided
      if (driveLink.trim()) {
        if (!isValidDriveFormat(driveLink)) {
          throw new Error('Please enter a valid Google Drive link (e.g. https://drive.google.com/file/d/...)');
        }
        const isValid = await validateDriveLink(driveLink);
        if (!isValid) {
          throw new Error(linkError || 'Google Drive link validation failed. Make sure sharing is set to "Anyone with the link".');
        }
      }

      if (submission) {
        const { error } = await supabase
          .from('assignment_submissions')
          .update({
            submission_text: text,
            file_url: driveLink.trim() || null,
            status: 'resubmitted',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', submission.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('assignment_submissions')
          .insert({
            assignment_id: assignmentId!,
            user_id: user!.id,
            submission_text: text,
            file_url: driveLink.trim() || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Submitted!', description: 'Your assignment has been submitted successfully.' });
      qc.invalidateQueries({ queryKey: ['submission', assignmentId] });
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
    },
    onError: (e: any) => {
      toast({ title: 'Submission Failed', description: e.message, variant: 'destructive' });
    },
  });

  const driveLinkFormatOk = !driveLink.trim() || isValidDriveFormat(driveLink);

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="container py-6 max-w-3xl">
          <Button variant="ghost" className="mb-4" onClick={() => navigate('/dashboard/assignments')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Assignments
          </Button>

          <div className="bg-card border rounded-xl p-6 space-y-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{assignment?.courses?.title}</p>
              <h1 className="font-heading text-xl font-bold">{assignment?.title}</h1>
              {assignment?.description && <p className="text-muted-foreground mt-2">{assignment.description}</p>}
            </div>

            {assignment?.instructions && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-medium text-sm mb-2">Instructions</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{assignment.instructions}</p>
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Max Score: <strong className="text-foreground">{assignment?.max_score}</strong></span>
              {assignment?.due_days && <span>Due: <strong className="text-foreground">{assignment.due_days} days</strong> after enrollment</span>}
            </div>

            {/* Graded feedback */}
            {submission?.status === 'graded' && (
              <div className="border rounded-lg p-4 space-y-2 bg-green-50/50 dark:bg-green-950/10">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-heading font-bold">Graded</h3>
                  <Badge>{submission.score}/{assignment?.max_score}</Badge>
                </div>
                {submission.feedback && (
                  <div className="flex gap-2 mt-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{submission.feedback}</p>
                  </div>
                )}
              </div>
            )}

            {submission?.status === 'returned' && (
              <div className="border border-destructive/30 rounded-lg p-4 bg-red-50/50 dark:bg-red-950/10">
                <h3 className="font-heading font-bold text-destructive mb-1">Returned for Revision</h3>
                {submission.feedback && <p className="text-sm text-muted-foreground">{submission.feedback}</p>}
              </div>
            )}

            {/* Submission form */}
            {(!submission || submission.status === 'returned') && (
              <div className="space-y-5 border-t pt-4">
                <h3 className="font-heading font-bold">Your Submission</h3>

                <div className="space-y-2">
                  <Label>Answer / Write-up</Label>
                  <Textarea
                    placeholder="Write your submission here..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={8}
                  />
                </div>

                {/* Google Drive Link Section */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">📎 Attach File via Google Drive</Label>

                  {/* Step-by-step instructions */}
                  <div className="bg-muted/50 border rounded-lg p-4">
                    <h4 className="text-sm font-semibold mb-3">Submission Steps:</h4>
                    <ol className="space-y-2.5 text-sm text-muted-foreground">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                        <span>Complete your assignment.</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                        <span>Upload the file to Google Drive.</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                        <span>Click <strong className="text-foreground">'Share'</strong> and set access to <strong className="text-foreground">'Anyone with the link'</strong>.</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                        <span>Copy and paste the link in the submission box below.</span>
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Google Drive Link (optional)</Label>
                    <div className="relative">
                      <Input
                        placeholder="https://drive.google.com/file/d/..."
                        value={driveLink}
                        onChange={(e) => {
                          setDriveLink(e.target.value);
                          setLinkStatus('idle');
                          setLinkError('');
                        }}
                        className={`pr-10 ${!driveLinkFormatOk ? 'border-destructive' : linkStatus === 'valid' ? 'border-green-500' : ''}`}
                      />
                      {linkStatus === 'checking' && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                      {linkStatus === 'valid' && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />}
                      {linkStatus === 'invalid' && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />}
                    </div>
                    {!driveLinkFormatOk && (
                      <p className="text-xs text-destructive">Please enter a valid Google Drive link.</p>
                    )}
                    {linkStatus === 'invalid' && linkError && (
                      <p className="text-xs text-destructive">{linkError}</p>
                    )}
                    {linkStatus === 'valid' && (
                      <p className="text-xs text-green-600">✓ Link verified — publicly accessible.</p>
                    )}
                  </div>
                </div>

                <Button
                  className="bg-accent hover:bg-accent-hover text-accent-foreground gap-2"
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending || !text.trim() || !driveLinkFormatOk || linkStatus === 'checking'}
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                  ) : (
                    <><Upload className="h-4 w-4" /> {submission ? 'Resubmit' : 'Submit Assignment'}</>
                  )}
                </Button>
              </div>
            )}

            {submission && submission.status !== 'returned' && (
              <div className="border-t pt-4">
                <h3 className="font-heading font-bold text-sm mb-2">Your Submission</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{submission.submission_text}</p>
                {submission.file_url && (
                  <a
                    href={submission.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1.5"
                  >
                    {isDriveUrl(submission.file_url) ? (
                      <>
                        <svg className="h-4 w-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6.6 66.85L3.3 61.35 29.3 17.45H58.1L31.65 61.65Z" fill="#0066DA"/>
                          <path d="M27.5 78L0 39 13.7 17.45 41.2 56.55Z" fill="#00AC47"/>
                          <path d="M45.5 78H0L13.7 56.55H59.2Z" fill="#EA4335"/>
                          <path d="M73.6 78H45.5L59.2 56.55H86.8Z" fill="#00832D"/>
                          <path d="M86.8 56.55L73.6 78 45.5 34.1 58.1 17.45Z" fill="#2684FC"/>
                          <path d="M58.1 17.45L86.8 56.55 73.1 34.1Z" fill="#FFBA00"/>
                        </svg>
                        Open in Google Drive
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3.5 w-3.5" />
                        View attached file
                      </>
                    )}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default AssignmentSubmit;

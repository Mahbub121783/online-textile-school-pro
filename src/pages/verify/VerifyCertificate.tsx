import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const VerifyCertificate = () => {
  const [certNumber, setCertNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);

  const handleVerify = async () => {
    if (!certNumber.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await supabase
        .from('certificates')
        .select('*, user_profiles!certificates_user_id_fkey(full_name), courses!certificates_course_id_fkey(title), workshops!certificates_workshop_id_fkey(title)')
        .eq('certificate_number', certNumber.trim())
        .maybeSingle();
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Verify Certificate" description="Verify the authenticity of a certificate issued by our platform." />
      <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Award className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold">Certificate Verification</h1>
          <p className="text-muted-foreground">Enter a certificate number to verify its authenticity.</p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="e.g. CERT-M4K5X2-AB3D"
            value={certNumber}
            onChange={e => setCertNumber(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            className="text-lg h-12"
          />
          <Button onClick={handleVerify} disabled={loading || !certNumber.trim()} className="h-12 px-6 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verify
          </Button>
        </div>

        {searched && !loading && (
          result ? (
            <Card className="overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500" />
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
                  <div>
                    <h3 className="font-heading font-bold text-lg text-green-700 dark:text-green-400">Certificate Verified ✓</h3>
                    <p className="text-sm text-muted-foreground">This certificate is authentic and was issued by our platform.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Student Name</p>
                    <p className="font-medium">{result.user_profiles?.full_name || 'Student'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{result.workshop_id ? 'Workshop' : 'Course'}</p>
                    <p className="font-medium">{result.workshops?.title || result.courses?.title || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Certificate Number</p>
                    <p className="font-mono text-sm">{result.certificate_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Issue Date</p>
                    <p className="font-medium">{result.issued_at ? format(new Date(result.issued_at), 'MMMM dd, yyyy') : '—'}</p>
                  </div>
                  {result.score_percentage != null && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Score</p>
                      <Badge variant="default">{result.score_percentage}%</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-red-500" />
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <XCircle className="h-8 w-8 text-red-500 shrink-0" />
                  <div>
                    <h3 className="font-heading font-bold text-lg text-red-600 dark:text-red-400">Certificate Not Found</h3>
                    <p className="text-sm text-muted-foreground">No certificate matches this number. Please check and try again.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        )}

        <div className="text-center">
          <Link to="/" className="text-sm text-primary hover:underline">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyCertificate;

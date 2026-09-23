import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IdCard, Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

interface VerifyResult {
  found: boolean;
  full_name?: string;
  roll_id?: string;
  department?: string | null;
  card_number?: string;
  university_name?: string;
  location?: string | null;
  status?: 'active' | 'expired' | 'revoked';
  valid_from?: string;
  valid_until?: string;
  issued_at?: string;
}

const VerifyStudent = () => {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [searched, setSearched] = useState(false);

  const handleVerify = async (value?: string) => {
    const q = (value ?? code).trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-student?code=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ found: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get('code');
    if (initial) handleVerify(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Verify Student Status" description="Independently verify the authenticity of an Online Textile School student ID card or enrollment letter." />
      <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <IdCard className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold">Student Status Verification</h1>
          <p className="text-muted-foreground">Enter the card / reference number printed on the document to independently confirm it was genuinely issued by Online Textile School.</p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="e.g. OTS-ID-264506"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            className="text-lg h-12"
          />
          <Button onClick={() => handleVerify()} disabled={loading || !code.trim()} className="h-12 px-6 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verify
          </Button>
        </div>

        {searched && !loading && (
          result?.found ? (
            <Card className="overflow-hidden">
              <div className={`h-1.5 bg-gradient-to-r ${result.status === 'active' ? 'from-green-500 via-emerald-500 to-green-500' : 'from-amber-500 via-orange-500 to-amber-500'}`} />
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`h-8 w-8 shrink-0 ${result.status === 'active' ? 'text-green-600' : 'text-amber-600'}`} />
                  <div>
                    <h3 className="font-heading font-bold text-lg text-green-700 dark:text-green-400">Record Verified ✓</h3>
                    <p className="text-sm text-muted-foreground">
                      This is a genuine {result.university_name || 'Online Textile School'} student record.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Student Name</p>
                    <p className="font-medium">{result.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Roll ID</p>
                    <p className="font-mono text-sm">{result.roll_id}</p>
                  </div>
                  {result.department && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Department</p>
                      <p className="font-medium">{result.department}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                    <Badge variant={result.status === 'active' ? 'default' : 'secondary'} className={result.status === 'active' ? 'bg-emerald-600' : ''}>
                      {result.status === 'active' ? 'Active' : result.status === 'expired' ? 'Expired' : 'Revoked'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Issued On</p>
                    <p className="font-medium">{result.issued_at ? format(new Date(result.issued_at), 'MMMM dd, yyyy') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Valid Until</p>
                    <p className="font-medium">{result.valid_until ? format(new Date(result.valid_until), 'MMMM dd, yyyy') : '—'}</p>
                  </div>
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
                    <h3 className="font-heading font-bold text-lg text-red-600 dark:text-red-400">Record Not Found</h3>
                    <p className="text-sm text-muted-foreground">No student record matches this number. Please check and try again.</p>
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

export default VerifyStudent;

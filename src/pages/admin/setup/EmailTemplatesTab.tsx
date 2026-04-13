import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Mail, Eye, Save, FileText } from 'lucide-react';

const TEMPLATE_TYPES = [
  { key: 'order_confirmation', label: 'Order Confirmation', placeholders: ['{{user_name}}', '{{order_id}}', '{{total}}', '{{items}}'] },
  { key: 'order_cancellation', label: 'Order Cancellation', placeholders: ['{{user_name}}', '{{order_id}}', '{{reason}}'] },
  { key: 'instructor_approved', label: 'Instructor Approved', placeholders: ['{{user_name}}', '{{login_url}}'] },
  { key: 'instructor_rejected', label: 'Instructor Rejected', placeholders: ['{{user_name}}', '{{reason}}'] },
  { key: 'student_approved', label: 'Student Account Approved', placeholders: ['{{user_name}}', '{{login_url}}'] },
  { key: 'student_rejected', label: 'Student Account Rejected', placeholders: ['{{user_name}}', '{{reason}}'] },
  { key: 'password_reset', label: 'Password Reset', placeholders: ['{{user_name}}', '{{reset_link}}'] },
  { key: 'welcome_email', label: 'Welcome Email', placeholders: ['{{user_name}}', '{{site_name}}'] },
  { key: 'enrollment_confirmation', label: 'Enrollment Confirmation', placeholders: ['{{user_name}}', '{{course_name}}', '{{course_url}}'] },
  { key: 'certificate_issued', label: 'Certificate Issued', placeholders: ['{{user_name}}', '{{course_name}}', '{{certificate_number}}', '{{download_url}}'] },
  { key: 'registration_approved', label: 'Registration Approved', placeholders: ['{{user_name}}', '{{registration_type}}', '{{login_url}}'] },
  { key: 'registration_rejected', label: 'Registration Rejected', placeholders: ['{{user_name}}', '{{registration_type}}', '{{reason}}'] },
  { key: 'push_notification', label: 'Push Notification', placeholders: ['{{user_name}}', '{{notification_title}}', '{{notification_body}}', '{{action_url}}'] },
  { key: 'account_suspended', label: 'Account Suspended', placeholders: ['{{user_name}}', '{{reason}}', '{{support_email}}'] },
  { key: 'payment_received', label: 'Payment Received', placeholders: ['{{user_name}}', '{{amount}}', '{{payment_method}}', '{{invoice_url}}'] },
  { key: 'refund_processed', label: 'Refund Processed', placeholders: ['{{user_name}}', '{{amount}}', '{{order_id}}'] },
];

interface TemplateData {
  subject: string;
  body: string;
}

const EmailTemplatesTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateData>({ subject: '', body: '' });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const keys = TEMPLATE_TYPES.map(t => `email_template_${t.key}`);
      const { data } = await supabase.from('site_settings').select('*').in('key', keys);
      const map: Record<string, TemplateData> = {};
      data?.forEach((s: any) => {
        try {
          map[s.key.replace('email_template_', '')] = JSON.parse(s.value || '{}');
        } catch { /* ignore parse errors */ }
      });
      return map;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: TemplateData }) => {
      const settingKey = `email_template_${key}`;
      const value = JSON.stringify(data);
      const { data: existing } = await supabase.from('site_settings').select('id').eq('key', settingKey).maybeSingle();
      if (existing) {
        await supabase.from('site_settings').update({ value }).eq('key', settingKey);
      } else {
        await supabase.from('site_settings').insert({ key: settingKey, value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setEditing(null);
      toast({ title: 'Template saved successfully' });
    },
    onError: () => toast({ title: 'Failed to save template', variant: 'destructive' }),
  });

  const openEditor = (key: string) => {
    const existing = templates?.[key];
    setFormData(existing || { subject: '', body: '' });
    setEditing(key);
  };

  const templateConfig = editing ? TEMPLATE_TYPES.find(t => t.key === editing) : null;
  const previewConfig = previewKey ? TEMPLATE_TYPES.find(t => t.key === previewKey) : null;
  const previewData = previewKey ? templates?.[previewKey] : null;

  if (isLoading) return <div className="text-muted-foreground">Loading templates...</div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Customize email templates sent to users. Use placeholder variables like <code className="bg-muted px-1 rounded">{'{{user_name}}'}</code> for dynamic content.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {TEMPLATE_TYPES.map(tmpl => {
          const hasTemplate = !!templates?.[tmpl.key]?.subject;
          return (
            <Card key={tmpl.key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {tmpl.label}
                  </CardTitle>
                  <Badge variant={hasTemplate ? 'default' : 'secondary'}>
                    {hasTemplate ? 'Configured' : 'Default'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3 truncate">
                  {templates?.[tmpl.key]?.subject || 'No custom subject set'}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditor(tmpl.key)}>
                    <Mail className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {hasTemplate && (
                    <Button size="sm" variant="ghost" onClick={() => setPreviewKey(tmpl.key)}>
                      <Eye className="h-3 w-3 mr-1" /> Preview
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Editor Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit: {templateConfig?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} placeholder="Enter email subject..." />
            </div>
            <div className="space-y-2">
              <Label>Email Body (HTML)</Label>
              <Textarea rows={12} value={formData.body} onChange={e => setFormData(p => ({ ...p, body: e.target.value }))} placeholder="Enter email body content..." className="font-mono text-xs" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Available Placeholders:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {templateConfig?.placeholders.map(p => (
                  <Badge key={p} variant="outline" className="text-xs cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, body: prev.body + ' ' + p }))}>
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
            <Button onClick={() => editing && saveMutation.mutate({ key: editing, data: formData })} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewKey} onOpenChange={() => setPreviewKey(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewConfig?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted p-3 rounded">
              <span className="text-xs font-medium text-muted-foreground">Subject:</span>
              <p className="text-sm font-medium">{previewData?.subject || 'No subject'}</p>
            </div>
            <div className="border rounded p-4 bg-background">
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewData?.body || '<p>No content</p>' }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplatesTab;

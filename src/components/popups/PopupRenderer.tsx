import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePopupEngine, PopupRow } from '@/hooks/usePopupEngine';
import { PopupLayout } from './PopupLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CountdownTimer } from '@/components/workshop/CountdownTimer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

interface VariantProps {
  popup: PopupRow;
  onClose: (reason?: 'dismiss' | 'cta_primary' | 'cta_secondary' | 'submit') => void;
}

// Smart navigation: internal paths use react-router, external opens new tab
const useCtaHandler = () => {
  const navigate = useNavigate();
  return (url: string) => {
    if (!url) return;
    const isExternal = /^https?:\/\//i.test(url) || url.startsWith('//') || url.startsWith('mailto:') || url.startsWith('tel:');
    if (isExternal) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url);
    }
  };
};

const PrimaryCta = ({ popup, onClose }: VariantProps) => {
  const go = useCtaHandler();
  if (!popup.cta_primary_label) return null;
  const handle = () => {
    onClose('cta_primary');
    if (popup.cta_primary_url) go(popup.cta_primary_url);
  };
  return (
    <Button
      onClick={handle}
      style={{ backgroundColor: popup.accent_color || undefined, color: '#fff' }}
      className="w-full sm:w-auto min-h-11"
    >
      {popup.cta_primary_label}
    </Button>
  );
};

const SecondaryCta = ({ popup, onClose }: VariantProps) => {
  const go = useCtaHandler();
  if (!popup.cta_secondary_label) return null;
  const handle = () => {
    onClose('cta_secondary');
    if (popup.cta_secondary_url) go(popup.cta_secondary_url);
  };
  return (
    <Button variant="outline" onClick={handle} className="w-full sm:w-auto min-h-11">
      {popup.cta_secondary_label}
    </Button>
  );
};

const FormVariant = ({ popup, onClose, fixedFields }: VariantProps & { fixedFields?: { name: string; label: string; type: string; required?: boolean }[] }) => {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const fields = fixedFields || (Array.isArray(popup.form_fields) ? popup.form_fields : []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await supabase.from('popup_submissions').insert({
        popup_id: popup.id,
        user_id: user?.id || null,
        email: data.email || null,
        form_data: data,
      });
      // Track submit analytics event explicitly
      await supabase.from('popup_analytics').insert({
        popup_id: popup.id,
        event_type: 'submit',
        user_id: user?.id || null,
        page_path: window.location.pathname,
      });
      toast.success('Submitted! Thank you.');
      onClose('submit');
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {popup.title && <h3 className="text-2xl font-heading font-bold">{popup.title}</h3>}
      {popup.subtitle && <p className="text-sm opacity-80">{popup.subtitle}</p>}
      {popup.body_content && <div className="text-sm opacity-90 prose-sm" dangerouslySetInnerHTML={{ __html: popup.body_content }} />}
      <div className="space-y-3">
        {fields.map((f: any) => (
          <div key={f.name}>
            <Label className="text-xs">{f.label}{f.required && ' *'}</Label>
            {f.type === 'textarea' ? (
              <Textarea
                required={f.required}
                value={data[f.name] || ''}
                onChange={e => setData(d => ({ ...d, [f.name]: e.target.value }))}
              />
            ) : (
              <Input
                type={f.type || 'text'}
                required={f.required}
                value={data[f.name] || ''}
                onChange={e => setData(d => ({ ...d, [f.name]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
      <Button type="submit" disabled={submitting} className="w-full" style={{ backgroundColor: popup.accent_color || undefined }}>
        {submitting ? 'Sending…' : popup.cta_primary_label || 'Submit'}
      </Button>
    </form>
  );
};

const StandardVariant = ({ popup, onClose }: VariantProps) => (
  <div className="space-y-4">
    {popup.image_url && (
      <img src={popup.image_url} alt={popup.title || ''} className="w-full rounded-lg max-h-64 object-cover" />
    )}
    {popup.title && <h3 className="text-2xl font-heading font-bold">{popup.title}</h3>}
    {popup.subtitle && <p className="text-base opacity-80">{popup.subtitle}</p>}
    {popup.body_content && <div className="text-sm opacity-90 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: popup.body_content }} />}
    {(popup.cta_primary_label || popup.cta_secondary_label) && (
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <PrimaryCta popup={popup} onClose={onClose} />
        <SecondaryCta popup={popup} onClose={onClose} />
      </div>
    )}
  </div>
);

const CountdownVariant = ({ popup, onClose }: VariantProps) => (
  <div className="space-y-4 text-center">
    {popup.title && <h3 className="text-2xl font-heading font-bold">{popup.title}</h3>}
    {popup.subtitle && <p className="text-base opacity-80">{popup.subtitle}</p>}
    {popup.countdown_target_date && (
      <div className="flex justify-center py-2">
        <CountdownTimer targetDate={new Date(popup.countdown_target_date)} />
      </div>
    )}
    {popup.body_content && <div className="text-sm opacity-90" dangerouslySetInnerHTML={{ __html: popup.body_content }} />}
    <div className="flex flex-col sm:flex-row gap-2 justify-center">
      <PrimaryCta popup={popup} onClose={onClose} />
      <SecondaryCta popup={popup} onClose={onClose} />
    </div>
  </div>
);

const PromoVariant = ({ popup, onClose }: VariantProps) => {
  const code = popup.cta_secondary_label || 'PROMO';
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };
  return (
    <div className="space-y-4 text-center">
      {popup.image_url && <img src={popup.image_url} alt="" className="w-20 h-20 mx-auto" />}
      {popup.title && <h3 className="text-3xl font-heading font-bold">{popup.title}</h3>}
      {popup.subtitle && <p className="text-base opacity-80">{popup.subtitle}</p>}
      <div className="border-2 border-dashed rounded-lg p-4 flex items-center justify-between gap-2" style={{ borderColor: popup.accent_color || undefined }}>
        <code className="text-xl font-mono font-bold flex-1">{code}</code>
        <Button size="sm" variant="ghost" onClick={copy}><Copy className="h-4 w-4" /></Button>
      </div>
      {popup.body_content && <div className="text-xs opacity-70" dangerouslySetInnerHTML={{ __html: popup.body_content }} />}
      <PrimaryCta popup={popup} onClose={onClose} />
    </div>
  );
};

const VideoVariant = ({ popup, onClose }: VariantProps) => (
  <div className="space-y-4">
    {popup.title && <h3 className="text-2xl font-heading font-bold">{popup.title}</h3>}
    {popup.video_url && (
      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        <iframe src={popup.video_url} className="w-full h-full" allowFullScreen title={popup.title || 'video'} />
      </div>
    )}
    {popup.body_content && <div className="text-sm opacity-90" dangerouslySetInnerHTML={{ __html: popup.body_content }} />}
    <div className="flex gap-2">
      <PrimaryCta popup={popup} onClose={onClose} />
      <SecondaryCta popup={popup} onClose={onClose} />
    </div>
  </div>
);

const ImageVariant = ({ popup, onClose }: VariantProps) => {
  const go = useCtaHandler();
  const handleClick = (e: React.MouseEvent) => {
    if (!popup.cta_primary_url) return;
    e.preventDefault();
    onClose('cta_primary');
    go(popup.cta_primary_url);
  };
  return (
    <div className="space-y-3">
      {popup.image_url && (
        <a
          href={popup.cta_primary_url || '#'}
          onClick={handleClick}
          className={popup.cta_primary_url ? 'block cursor-pointer' : 'block pointer-events-none'}
        >
          <img src={popup.image_url} alt={popup.title || ''} className="w-full rounded-lg max-h-[70vh] object-contain" />
        </a>
      )}
      {popup.title && <h3 className="text-xl font-heading font-bold text-center">{popup.title}</h3>}
    </div>
  );
};

const HtmlVariant = ({ popup }: VariantProps) => (
  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: popup.body_content || '' }} />
);

const AnnouncementVariant = ({ popup, onClose }: VariantProps) => {
  const go = useCtaHandler();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <div className="flex-1 min-w-0">
        {popup.title && <span className="font-bold mr-2">{popup.title}</span>}
        {popup.subtitle && <span className="opacity-90 text-sm sm:text-base">{popup.subtitle}</span>}
      </div>
      {popup.cta_primary_label && (
        <Button
          size="sm"
          className="shrink-0 min-h-10 w-full sm:w-auto"
          onClick={() => { onClose('cta_primary'); if (popup.cta_primary_url) go(popup.cta_primary_url); }}
          style={{ backgroundColor: popup.accent_color || undefined }}
        >
          {popup.cta_primary_label}
        </Button>
      )}
    </div>
  );
};

export function PopupRenderer() {
  const { activePopup, close } = usePopupEngine();
  if (!activePopup) return null;

  const variantProps = { popup: activePopup, onClose: close };

  let inner;
  switch (activePopup.type) {
    case 'newsletter':
      inner = <FormVariant {...variantProps} fixedFields={[{ name: 'email', label: 'Email address', type: 'email', required: true }]} />;
      break;
    case 'registration':
      inner = <FormVariant {...variantProps} />;
      break;
    case 'event':
      inner = <StandardVariant {...variantProps} />;
      break;
    case 'countdown':
      inner = <CountdownVariant {...variantProps} />;
      break;
    case 'promo':
      inner = <PromoVariant {...variantProps} />;
      break;
    case 'video':
      inner = <VideoVariant {...variantProps} />;
      break;
    case 'image':
      inner = <ImageVariant {...variantProps} />;
      break;
    case 'custom_html':
      inner = <HtmlVariant {...variantProps} />;
      break;
    case 'announcement':
      inner = <AnnouncementVariant {...variantProps} />;
      break;
    default:
      inner = <StandardVariant {...variantProps} />;
  }

  return (
    <PopupLayout
      layout={activePopup.layout}
      size={activePopup.size}
      animation={activePopup.animation}
      background={activePopup.background_color}
      textColor={activePopup.text_color}
      onClose={close}
    >
      {inner}
    </PopupLayout>
  );
}

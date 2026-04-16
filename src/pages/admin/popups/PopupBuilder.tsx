import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  popupId: string | null;
  onSaved: () => void;
}

const defaults: any = {
  name: '',
  is_active: false,
  type: 'announcement',
  title: '',
  subtitle: '',
  body_content: '',
  image_url: '',
  video_url: '',
  background_color: '#ffffff',
  text_color: '#0f172a',
  accent_color: '#3b82f6',
  cta_primary_label: '',
  cta_primary_url: '',
  cta_secondary_label: '',
  cta_secondary_url: '',
  layout: 'center_modal',
  size: 'md',
  animation: 'fade',
  trigger_type: 'delay',
  trigger_value: 3,
  target_pages: ['/'],
  exclude_pages: [],
  target_devices: 'all',
  target_user_state: 'all',
  frequency: 'once',
  frequency_value: 1,
  start_date: '',
  end_date: '',
  countdown_target_date: '',
  form_fields: [],
  priority: 0,
};

export function PopupBuilder({ open, onClose, popupId, onSaved }: Props) {
  const [form, setForm] = useState<any>(defaults);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!popupId) { setForm(defaults); return; }
    setLoading(true);
    supabase.from('popups').select('*').eq('id', popupId).single().then(({ data }) => {
      if (data) {
        setForm({
          ...data,
          start_date: data.start_date ? data.start_date.slice(0, 16) : '',
          end_date: data.end_date ? data.end_date.slice(0, 16) : '',
          countdown_target_date: data.countdown_target_date ? data.countdown_target_date.slice(0, 16) : '',
          target_pages: data.target_pages || [],
          exclude_pages: data.exclude_pages || [],
          form_fields: data.form_fields || [],
        });
      }
      setLoading(false);
    });
  }, [open, popupId]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const payload: any = {
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      countdown_target_date: form.countdown_target_date || null,
      target_pages: form.target_pages.filter((p: string) => p.trim()),
      exclude_pages: form.exclude_pages.filter((p: string) => p.trim()),
    };
    const { error } = popupId
      ? await supabase.from('popups').update(payload).eq('id', popupId)
      : await supabase.from('popups').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Saved');
    onSaved();
  };

  const addField = () => set('form_fields', [...form.form_fields, { name: `field_${form.form_fields.length + 1}`, label: 'Label', type: 'text', required: false }]);
  const updateField = (i: number, patch: any) => set('form_fields', form.form_fields.map((f: any, idx: number) => idx === i ? { ...f, ...patch } : f));
  const removeField = (i: number) => set('form_fields', form.form_fields.filter((_: any, idx: number) => idx !== i));

  const addPage = (key: 'target_pages' | 'exclude_pages') => set(key, [...form[key], '']);
  const updatePage = (key: 'target_pages' | 'exclude_pages', i: number, v: string) => set(key, form[key].map((p: string, idx: number) => idx === i ? v : p));
  const removePage = (key: 'target_pages' | 'exclude_pages', i: number) => set(key, form[key].filter((_: string, idx: number) => idx !== i));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{popupId ? 'Edit Popup' : 'Create Popup'}</DialogTitle></DialogHeader>
        {loading ? <div className="py-12 text-center text-muted-foreground">Loading…</div> : (
          <Tabs defaultValue="content">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="behavior">Behavior</TabsTrigger>
              <TabsTrigger value="targeting">Targeting</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Internal name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={v => set('type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['announcement', 'newsletter', 'registration', 'event', 'countdown', 'promo', 'image', 'video', 'custom_html'].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Title</Label><Input value={form.title || ''} onChange={e => set('title', e.target.value)} /></div>
              <div><Label>Subtitle</Label><Input value={form.subtitle || ''} onChange={e => set('subtitle', e.target.value)} /></div>
              <div><Label>Body (HTML allowed)</Label><Textarea rows={4} value={form.body_content || ''} onChange={e => set('body_content', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Image URL</Label><Input value={form.image_url || ''} onChange={e => set('image_url', e.target.value)} placeholder="https://…" /></div>
                <div><Label>Video URL (embed)</Label><Input value={form.video_url || ''} onChange={e => set('video_url', e.target.value)} placeholder="YouTube/Vimeo embed" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Primary CTA label</Label><Input value={form.cta_primary_label || ''} onChange={e => set('cta_primary_label', e.target.value)} /></div>
                <div><Label>Primary CTA URL</Label><Input value={form.cta_primary_url || ''} onChange={e => set('cta_primary_url', e.target.value)} /></div>
                <div><Label>Secondary CTA label</Label><Input value={form.cta_secondary_label || ''} onChange={e => set('cta_secondary_label', e.target.value)} /></div>
                <div><Label>Secondary CTA URL</Label><Input value={form.cta_secondary_url || ''} onChange={e => set('cta_secondary_url', e.target.value)} /></div>
              </div>
              {form.type === 'promo' && (
                <p className="text-xs text-muted-foreground">For Promo type, the secondary CTA label is used as the discount code shown to the user.</p>
              )}
              {(form.type === 'registration' || form.type === 'newsletter') && form.type === 'registration' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Form Fields</Label>
                    <Button size="sm" variant="outline" onClick={addField}><Plus className="h-3 w-3 mr-1" /> Field</Button>
                  </div>
                  {form.form_fields.map((f: any, i: number) => (
                    <Card key={i} className="p-3 grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3"><Label className="text-xs">Name</Label><Input value={f.name} onChange={e => updateField(i, { name: e.target.value })} /></div>
                      <div className="col-span-3"><Label className="text-xs">Label</Label><Input value={f.label} onChange={e => updateField(i, { label: e.target.value })} /></div>
                      <div className="col-span-3">
                        <Label className="text-xs">Type</Label>
                        <Select value={f.type} onValueChange={v => updateField(i, { type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['text', 'email', 'tel', 'number', 'textarea'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 flex items-center gap-2"><Switch checked={f.required} onCheckedChange={v => updateField(i, { required: v })} /><span className="text-xs">Required</span></div>
                      <div className="col-span-1"><Button size="icon" variant="ghost" onClick={() => removeField(i)}><Trash2 className="h-4 w-4" /></Button></div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="design" className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Layout</Label>
                  <Select value={form.layout} onValueChange={v => set('layout', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['center_modal', 'slide_in_bottom_right', 'slide_in_bottom_left', 'top_banner', 'bottom_banner', 'fullscreen'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Size</Label>
                  <Select value={form.size} onValueChange={v => set('size', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['sm', 'md', 'lg', 'xl'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Animation</Label>
                  <Select value={form.animation} onValueChange={v => set('animation', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['fade', 'zoom', 'slide', 'bounce'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Background</Label><Input type="color" value={form.background_color} onChange={e => set('background_color', e.target.value)} className="h-10" /></div>
                <div><Label>Text color</Label><Input type="color" value={form.text_color} onChange={e => set('text_color', e.target.value)} className="h-10" /></div>
                <div><Label>Accent color</Label><Input type="color" value={form.accent_color} onChange={e => set('accent_color', e.target.value)} className="h-10" /></div>
              </div>
              <Card className="p-4 space-y-2" style={{ backgroundColor: form.background_color, color: form.text_color }}>
                <p className="text-xs uppercase opacity-60">Preview</p>
                {form.title && <h3 className="text-xl font-bold">{form.title}</h3>}
                {form.subtitle && <p className="text-sm opacity-80">{form.subtitle}</p>}
                {form.cta_primary_label && (
                  <button className="px-4 py-2 rounded text-white text-sm" style={{ backgroundColor: form.accent_color }}>{form.cta_primary_label}</button>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="behavior" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Trigger</Label>
                  <Select value={form.trigger_type} onValueChange={v => set('trigger_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_load">Immediately on load</SelectItem>
                      <SelectItem value="delay">After delay (sec)</SelectItem>
                      <SelectItem value="scroll_percent">Scroll %</SelectItem>
                      <SelectItem value="exit_intent">Exit intent</SelectItem>
                      <SelectItem value="time_on_page">Time on page (sec)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Trigger value</Label><Input type="number" value={form.trigger_value} onChange={e => set('trigger_value', parseInt(e.target.value) || 0)} /></div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={form.frequency} onValueChange={v => set('frequency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once per user</SelectItem>
                      <SelectItem value="every_visit">Every visit</SelectItem>
                      <SelectItem value="every_n_days">Every N days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.frequency === 'every_n_days' && (
                  <div><Label>Days</Label><Input type="number" value={form.frequency_value || 1} onChange={e => set('frequency_value', parseInt(e.target.value) || 1)} /></div>
                )}
                <div><Label>Start date</Label><Input type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
                <div><Label>End date</Label><Input type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
              </div>
              {form.type === 'countdown' && (
                <div><Label>Countdown target date</Label><Input type="datetime-local" value={form.countdown_target_date} onChange={e => set('countdown_target_date', e.target.value)} /></div>
              )}
              <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} /><Label>Active</Label></div>
            </TabsContent>

            <TabsContent value="targeting" className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Devices</Label>
                  <Select value={form.target_devices} onValueChange={v => set('target_devices', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="mobile">Mobile only</SelectItem>
                      <SelectItem value="desktop">Desktop only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>User state</Label>
                  <Select value={form.target_user_state} onValueChange={v => set('target_user_state', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All visitors</SelectItem>
                      <SelectItem value="guest">Guests only</SelectItem>
                      <SelectItem value="logged_in">Logged-in only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={e => set('priority', parseInt(e.target.value) || 0)} /></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Target pages (use * for wildcards, e.g. /courses/*)</Label>
                  <Button size="sm" variant="outline" onClick={() => addPage('target_pages')}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                </div>
                {form.target_pages.map((p: string, i: number) => (
                  <div key={i} className="flex gap-2"><Input value={p} onChange={e => updatePage('target_pages', i, e.target.value)} placeholder="/" /><Button size="icon" variant="ghost" onClick={() => removePage('target_pages', i)}><Trash2 className="h-4 w-4" /></Button></div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Exclude pages</Label>
                  <Button size="sm" variant="outline" onClick={() => addPage('exclude_pages')}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                </div>
                {form.exclude_pages.map((p: string, i: number) => (
                  <div key={i} className="flex gap-2"><Input value={p} onChange={e => updatePage('exclude_pages', i, e.target.value)} placeholder="/admin/*" /><Button size="icon" variant="ghost" onClick={() => removePage('exclude_pages', i)}><Trash2 className="h-4 w-4" /></Button></div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Popup'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

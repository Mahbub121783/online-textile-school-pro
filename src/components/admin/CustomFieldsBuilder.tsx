import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ChevronUp, ChevronDown, Copy, GripVertical, X } from 'lucide-react';

export type CustomFieldType =
  | 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'url'
  | 'date' | 'time' | 'datetime'
  | 'select' | 'multiselect' | 'radio' | 'checkbox'
  | 'file' | 'rating';

export interface CustomField {
  key: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: string;
  width?: 'full' | 'half';
}

const TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'select', label: 'Dropdown (Single)' },
  { value: 'multiselect', label: 'Checkboxes (Multi)' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Yes / No Toggle' },
  { value: 'file', label: 'File Upload' },
  { value: 'rating', label: 'Star Rating' },
];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';

const HAS_OPTIONS = (t: CustomFieldType) => t === 'select' || t === 'multiselect' || t === 'radio';
const HAS_RANGE = (t: CustomFieldType) => t === 'number' || t === 'rating';

interface Props {
  value: CustomField[];
  onChange: (fields: CustomField[]) => void;
}

export default function CustomFieldsBuilder({ value, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');

  const fields = Array.isArray(value) ? value : [];

  const update = (i: number, patch: Partial<CustomField>) => {
    const next = fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    onChange(next);
  };

  const add = () => {
    const next: CustomField = {
      key: `field_${fields.length + 1}`,
      label: `New Field ${fields.length + 1}`,
      type: 'text',
      required: false,
      width: 'full',
    };
    onChange([...fields, next]);
    setOpenIdx(fields.length);
  };

  const remove = (i: number) => {
    if (!confirm('Delete this field?')) return;
    onChange(fields.filter((_, idx) => idx !== i));
    setOpenIdx(null);
  };

  const duplicate = (i: number) => {
    const f = fields[i];
    const copy = { ...f, key: `${f.key}_copy`, label: `${f.label} (copy)` };
    const next = [...fields.slice(0, i + 1), copy, ...fields.slice(i + 1)];
    onChange(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const keys = fields.map(f => f.key);
  const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Custom Fields</Label>
          <p className="text-xs text-muted-foreground">Build a dynamic form. Drag-free reorder using arrows.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { setJsonDraft(JSON.stringify(fields, null, 2)); setShowJson(v => !v); }}>
            {showJson ? 'Hide' : 'JSON'}
          </Button>
          <Button type="button" size="sm" onClick={add}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Field
          </Button>
        </div>
      </div>

      {fields.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
          No custom fields yet. Click <span className="font-medium text-foreground">Add Field</span> to create one.
        </div>
      )}

      <div className="space-y-2">
        {fields.map((f, i) => {
          const open = openIdx === i;
          const dup = dupKeys.includes(f.key);
          const invalidKey = !/^[a-z0-9_]+$/.test(f.key);
          return (
            <div key={i} className={`border rounded-lg bg-card ${dup || invalidKey ? 'border-destructive' : ''}`}>
              <div
                className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/40"
                onClick={() => setOpenIdx(open ? null : i)}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{f.label || '(no label)'}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{f.type}</Badge>
                    {f.required && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
                    {f.width === 'half' && <Badge variant="secondary" className="text-[10px]">Half</Badge>}
                    {(dup || invalidKey) && <Badge variant="destructive" className="text-[10px]">Bad key</Badge>}
                  </div>
                  <code className="text-[10px] text-muted-foreground">{f.key}</code>
                </div>
                <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp className="w-4 h-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === fields.length - 1}><ChevronDown className="w-4 h-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicate(i)}><Copy className="w-3.5 h-3.5" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {open && (
                <div className="border-t p-3 space-y-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label *</Label>
                      <Input
                        value={f.label}
                        onChange={e => {
                          const label = e.target.value;
                          // auto-update key only if user hasn't customized it
                          const autoKey = slugify(f.label);
                          const patch: Partial<CustomField> = { label };
                          if (f.key === autoKey || f.key.startsWith('field_')) patch.key = slugify(label);
                          update(i, patch);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Key *</Label>
                      <Input value={f.key} onChange={e => update(i, { key: e.target.value })} />
                      {invalidKey && <p className="text-[10px] text-destructive">Lowercase letters, numbers, underscore only</p>}
                      {dup && <p className="text-[10px] text-destructive">Duplicate key</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={f.type} onValueChange={(v: CustomFieldType) => update(i, { type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Width</Label>
                      <Select value={f.width || 'full'} onValueChange={(v: 'full' | 'half') => update(i, { width: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full row</SelectItem>
                          <SelectItem value="half">Half row</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Placeholder</Label>
                      <Input value={f.placeholder || ''} onChange={e => update(i, { placeholder: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Default Value</Label>
                      <Input value={f.defaultValue || ''} onChange={e => update(i, { defaultValue: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Help Text</Label>
                    <Input value={f.helpText || ''} onChange={e => update(i, { helpText: e.target.value })} placeholder="Shown beneath the input" />
                  </div>

                  {HAS_RANGE(f.type) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Min</Label>
                        <Input type="number" value={f.min ?? ''} onChange={e => update(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max</Label>
                        <Input type="number" value={f.max ?? ''} onChange={e => update(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
                      </div>
                    </div>
                  )}

                  {HAS_OPTIONS(f.type) && (
                    <OptionsEditor
                      options={f.options || []}
                      onChange={(options) => update(i, { options })}
                    />
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={!!f.required} onCheckedChange={v => update(i, { required: v })} />
                    <Label className="text-xs">Required field</Label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showJson && (
        <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Raw JSON (advanced)</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  const parsed = JSON.parse(jsonDraft);
                  if (!Array.isArray(parsed)) throw new Error('Must be an array');
                  onChange(parsed);
                  alert('Imported');
                } catch (e: any) {
                  alert('Invalid JSON: ' + e.message);
                }
              }}
            >Apply JSON</Button>
          </div>
          <Textarea rows={8} value={jsonDraft} onChange={e => setJsonDraft(e.target.value)} className="font-mono text-xs" />
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const addOpt = () => {
    const v = draft.trim();
    if (!v) return;
    if (options.includes(v)) { setDraft(''); return; }
    onChange([...options, v]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <Label className="text-xs">Options</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOpt(); } }}
          placeholder="Type an option and press Enter"
        />
        <Button type="button" size="sm" onClick={addOpt}>Add</Button>
      </div>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o, idx) => (
            <Badge key={idx} variant="secondary" className="gap-1 pr-1">
              {o}
              <button type="button" onClick={() => onChange(options.filter((_, i) => i !== idx))} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {options.length === 0 && <p className="text-[10px] text-muted-foreground">No options yet — add at least one.</p>}
    </div>
  );
}

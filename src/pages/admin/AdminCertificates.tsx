import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, Plus, Trash2, Eye, Upload, Save, GripVertical, Italic, AlignLeft, AlignCenter, AlignRight, Download, Type, Image as ImageIcon, Copy, RotateCcw, Move, Maximize2 } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { CertificateField, CertificateData } from '@/lib/certificateRenderer';
import { renderFieldsSync, preloadImage, getCachedImage, downloadCertificatePDF } from '@/lib/certificateRenderer';

// ── Font system with handwritten/calligraphy fonts ──
const FONT_FAMILIES = [
  'Arial, sans-serif',
  'Times New Roman, serif',
  'Georgia, serif',
  'Courier New, monospace',
  "'Great Vibes', cursive",
  "'Dancing Script', cursive",
  "'Pacifico', cursive",
  "'Satisfy', cursive",
  "'Sacramento', cursive",
  "'Allura', cursive",
  "'Tangerine', cursive",
  "'Pinyon Script', cursive",
  "'Alex Brush', cursive",
  "'Cormorant Garamond', serif",
  "'Playfair Display', serif",
  "'Cinzel', serif",
];

const FONT_LABELS: Record<string, string> = {
  'Arial, sans-serif': 'Arial',
  'Times New Roman, serif': 'Times New Roman',
  'Georgia, serif': 'Georgia',
  'Courier New, monospace': 'Courier New',
  "'Great Vibes', cursive": '✍ Great Vibes',
  "'Dancing Script', cursive": '✍ Dancing Script',
  "'Pacifico', cursive": '✍ Pacifico',
  "'Satisfy', cursive": '✍ Satisfy',
  "'Sacramento', cursive": '✍ Sacramento',
  "'Allura', cursive": '✍ Allura',
  "'Tangerine', cursive": '✍ Tangerine',
  "'Pinyon Script', cursive": '✍ Pinyon Script',
  "'Alex Brush', cursive": '✍ Alex Brush',
  "'Cormorant Garamond', serif": 'Cormorant Garamond',
  "'Playfair Display', serif": 'Playfair Display',
  "'Cinzel', serif": 'Cinzel',
};

const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Dancing+Script:wght@400;700&family=Pacifico&family=Satisfy&family=Sacramento&family=Allura&family=Tangerine:wght@400;700&family=Pinyon+Script&family=Alex+Brush&family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;700&display=swap';

const DEFAULT_FIELDS: CertificateField[] = [
  { key: 'custom_text', label: 'Title Text', x: 50, y: 20, fontSize: 28, fontColor: '#1a1a1a', fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'Georgia, serif', textAlign: 'center', visible: true, value: 'Certificate of Completion', type: 'text' },
  { key: 'student_name', label: 'Student Name', x: 50, y: 42, fontSize: 32, fontColor: '#1a1a1a', fontWeight: 'bold', fontStyle: 'normal', fontFamily: "'Great Vibes', cursive", textAlign: 'center', visible: true, type: 'text' },
  { key: 'course_title', label: 'Course Title', x: 50, y: 55, fontSize: 20, fontColor: '#333333', fontWeight: 'semibold', fontStyle: 'normal', fontFamily: 'Arial, sans-serif', textAlign: 'center', visible: true, type: 'text' },
  { key: 'completion_date', label: 'Completion Date', x: 50, y: 68, fontSize: 14, fontColor: '#555555', fontWeight: 'normal', fontStyle: 'normal', fontFamily: 'Arial, sans-serif', textAlign: 'center', visible: true, type: 'text' },
  { key: 'certificate_number', label: 'Certificate #', x: 50, y: 88, fontSize: 11, fontColor: '#888888', fontWeight: 'normal', fontStyle: 'normal', fontFamily: 'Courier New, monospace', textAlign: 'center', visible: true, type: 'text' },
  { key: 'instructor_signature', label: 'Instructor Signature', x: 75, y: 82, fontSize: 16, fontColor: '#333333', fontWeight: 'normal', fontStyle: 'italic', fontFamily: "'Dancing Script', cursive", textAlign: 'center', visible: true, type: 'text' },
];

const SAMPLE_DATA: CertificateData = {
  student_name: 'John Doe',
  course_title: 'Advanced Industrial Weaving',
  certificate_number: 'CERT-2026-0001',
  completion_date: 'March 25, 2026',
  instructor_signature: 'Prof. Rahman',
};

const AdminCertificates = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('templates');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<CertificateField[]>(DEFAULT_FIELDS);
  const [downloadRule, setDownloadRule] = useState('course_complete');
  const [minScorePct, setMinScorePct] = useState(60);
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [assignedCourses, setAssignedCourses] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const { upload, uploading } = useFileUpload();

  const [dragging, setDragging] = useState<number | null>(null);
  const [resizing, setResizing] = useState<{ idx: number; corner: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [customFieldCounter, setCustomFieldCounter] = useState(1);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Load Google Fonts
  useEffect(() => {
    if (document.querySelector('link[data-cert-fonts]')) { setFontsLoaded(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    link.setAttribute('data-cert-fonts', 'true');
    link.onload = () => {
      // Wait for fonts to actually render
      setTimeout(() => setFontsLoaded(true), 500);
    };
    document.head.appendChild(link);
  }, []);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['certificate-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('certificate_templates').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['all-courses-for-cert'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title, cert_template_id').order('title');
      return data ?? [];
    },
  });

  const { data: issuedCerts = [], isLoading: certsLoading } = useQuery({
    queryKey: ['all-issued-certificates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('certificates')
        .select('*, user_profiles!certificates_user_id_fkey(full_name), courses!certificates_course_id_fkey(title)')
        .order('issued_at', { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  // Preload background image when URL changes
  useEffect(() => {
    if (backgroundUrl) {
      preloadImage(backgroundUrl).then(img => { bgImageRef.current = img; renderCanvas(); });
    } else {
      bgImageRef.current = null;
      renderCanvas();
    }
  }, [backgroundUrl]);

  // Preload all image fields
  useEffect(() => {
    fields.forEach(f => {
      if (f.type === 'image' && f.imageUrl) {
        preloadImage(f.imageUrl).then(() => renderCanvas());
      }
    });
  }, [fields]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: templateName,
        background_url: backgroundUrl,
        fields_config: fields as any,
        download_rule: downloadRule,
        min_score_pct: minScorePct,
      };
      if (editingId) {
        const { error } = await supabase.from('certificate_templates').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('certificate_templates').insert(payload).select().single();
        if (error) throw error;
        setEditingId(data.id);
      }
      if (editingId) {
        await supabase.from('courses').update({ cert_template_id: null } as any).eq('cert_template_id', editingId);
      }
      const templateId = editingId || (await supabase.from('certificate_templates').select('id').eq('name', templateName).single()).data?.id;
      if (templateId && assignedCourses.length > 0) {
        for (const cid of assignedCourses) {
          await supabase.from('courses').update({ cert_template_id: templateId } as any).eq('id', cid);
        }
      }
    },
    onSuccess: () => {
      toast.success('Template saved!');
      queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
      queryClient.invalidateQueries({ queryKey: ['all-courses-for-cert'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('courses').update({ cert_template_id: null } as any).eq('cert_template_id', id);
      const { error } = await supabase.from('certificate_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
  });

  const loadTemplate = (tpl: any) => {
    setEditingId(tpl.id);
    setTemplateName(tpl.name);
    setBackgroundUrl(tpl.background_url);
    const loadedFields = (tpl.fields_config || DEFAULT_FIELDS).map((f: any) => ({
      ...f,
      type: f.type || 'text',
      fontStyle: f.fontStyle || 'normal',
      fontFamily: f.fontFamily || 'Arial, sans-serif',
      textAlign: f.textAlign || 'center',
    }));
    setFields(loadedFields);
    setDownloadRule(tpl.download_rule || 'course_complete');
    setMinScorePct(tpl.min_score_pct || 60);
    setAssignedCourses(courses.filter((c: any) => c.cert_template_id === tpl.id).map((c: any) => c.id));
    setActiveTab('builder');
  };

  const resetBuilder = () => {
    setEditingId(null);
    setTemplateName('');
    setBackgroundUrl(null);
    setFields(DEFAULT_FIELDS);
    setDownloadRule('course_complete');
    setMinScorePct(60);
    setAssignedCourses([]);
    setSelectedField(null);
    bgImageRef.current = null;
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await upload(file);
      setBackgroundUrl(result.url);
      toast.success('Background uploaded');
    } catch {}
  };

  const handleImageFieldUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await upload(file);
      updateField(idx, { imageUrl: result.url });
      preloadImage(result.url).then(() => renderCanvas());
      toast.success('Image uploaded');
    } catch {}
  };

  const updateField = useCallback((idx: number, updates: Partial<CertificateField>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  }, []);

  const addCustomField = () => {
    const newField: CertificateField = {
      key: 'custom_text',
      label: `Custom Text ${customFieldCounter + 1}`,
      x: 50, y: 50, fontSize: 16, fontColor: '#333333',
      fontWeight: 'normal', fontStyle: 'normal',
      fontFamily: 'Arial, sans-serif', textAlign: 'center',
      visible: true, value: 'New Text', type: 'text',
    };
    setFields(prev => [...prev, newField]);
    setCustomFieldCounter(prev => prev + 1);
    setSelectedField(fields.length);
  };

  const addImageField = () => {
    const newField: CertificateField = {
      key: 'custom_image',
      label: `Signature / Image`,
      x: 25, y: 80, fontSize: 12, fontColor: '#000000',
      fontWeight: 'normal', fontStyle: 'normal',
      fontFamily: 'Arial, sans-serif', textAlign: 'center',
      visible: true, type: 'image',
      imageUrl: '', width: 15, height: 8, opacity: 1, rotation: 0,
    };
    setFields(prev => [...prev, newField]);
    setSelectedField(fields.length);
  };

  const duplicateField = (idx: number) => {
    const orig = fields[idx];
    const clone: CertificateField = {
      ...orig,
      label: orig.label + ' (copy)',
      x: Math.min(orig.x + 5, 95),
      y: Math.min(orig.y + 5, 95),
    };
    setFields(prev => [...prev, clone]);
    setSelectedField(fields.length);
  };

  const removeField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
    setSelectedField(null);
  };

  const moveFieldOrder = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= fields.length) return;
    setFields(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
    setSelectedField(newIdx);
  };

  // ── Synchronous canvas rendering ──
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = previewContainerRef.current;
    if (!canvas || !container) return;

    const displayW = container.clientWidth;
    const displayH = Math.round(displayW / (1122 / 793));
    canvas.width = displayW;
    canvas.height = displayH;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, displayW, displayH);

    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, displayW, displayH);
    }

    const scale = displayW / 1122;
    const scaledFields = fields.map(f => ({ ...f, fontSize: Math.round(f.fontSize * scale) }));
    renderFieldsSync(ctx, scaledFields, SAMPLE_DATA, displayW, displayH, selectedField, true);
  }, [fields, selectedField]);

  useEffect(() => {
    if (activeTab === 'builder') {
      requestAnimationFrame(renderCanvas);
    }
  }, [activeTab, renderCanvas, fields, selectedField, fontsLoaded]);

  // ── Drag & Resize handlers ──
  const getCanvasPercent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      xPct: Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100)),
      yPct: Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { xPct, yPct } = getCanvasPercent(e);

    // Check for resize handle on selected image field
    if (selectedField !== null) {
      const f = fields[selectedField];
      if (f.type === 'image' && f.visible) {
        const hw = (f.width || 15) / 2;
        const hh = (f.height || 8) / 2;
        const corners = [
          { name: 'tl', cx: f.x - hw, cy: f.y - hh },
          { name: 'tr', cx: f.x + hw, cy: f.y - hh },
          { name: 'bl', cx: f.x - hw, cy: f.y + hh },
          { name: 'br', cx: f.x + hw, cy: f.y + hh },
        ];
        for (const c of corners) {
          if (Math.abs(xPct - c.cx) < 2 && Math.abs(yPct - c.cy) < 2) {
            setResizing({ idx: selectedField, corner: c.name, startX: xPct, startY: yPct, startW: f.width || 15, startH: f.height || 8 });
            return;
          }
        }
      }
    }

    let closest = -1;
    let minDist = 8;
    fields.forEach((f, i) => {
      if (!f.visible) return;
      const dist = Math.sqrt((f.x - xPct) ** 2 + (f.y - yPct) ** 2);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    if (closest >= 0) {
      setDragging(closest);
      setSelectedField(closest);
    } else {
      setSelectedField(null);
    }
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (resizing) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      const dx = xPct - resizing.startX;
      const dy = yPct - resizing.startY;
      let newW = resizing.startW;
      let newH = resizing.startH;
      if (resizing.corner.includes('r')) newW = Math.max(3, resizing.startW + dx);
      if (resizing.corner.includes('l')) newW = Math.max(3, resizing.startW - dx);
      if (resizing.corner.includes('b')) newH = Math.max(2, resizing.startH + dy);
      if (resizing.corner.includes('t')) newH = Math.max(2, resizing.startH - dy);
      setFields(prev => prev.map((f, i) => i === resizing.idx ? { ...f, width: Math.round(newW * 10) / 10, height: Math.round(newH * 10) / 10 } : f));
      return;
    }
    if (dragging === null) return;
    const { xPct, yPct } = getCanvasPercent(e);
    setFields(prev => prev.map((f, i) => i === dragging ? { ...f, x: Math.round(xPct * 10) / 10, y: Math.round(yPct * 10) / 10 } : f));
  }, [dragging, resizing]);

  const handleCanvasMouseUp = () => { setDragging(null); setResizing(null); };

  const toggleCourseAssignment = (courseId: string) => {
    setAssignedCourses(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
  };

  const handleSamplePDF = async () => {
    try {
      toast.info('Generating sample PDF...');
      await downloadCertificatePDF(backgroundUrl, fields, SAMPLE_DATA, 'sample-certificate.pdf');
      toast.success('Sample PDF downloaded!');
    } catch (e: any) {
      toast.error('PDF generation failed: ' + e.message);
    }
  };

  // ── Field Editor Panel ──
  const renderFieldEditor = (f: CertificateField, i: number) => {
    if (f.type === 'image') {
      return (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div>
            <Label className="text-[10px]">Upload Image (Signature/Stamp/Logo)</Label>
            <div className="flex gap-2 items-center mt-1">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={e => handleImageFieldUpload(e, i)} />
                <Button asChild size="sm" variant="outline" disabled={uploading}>
                  <span><Upload className="h-3.5 w-3.5 mr-1" />{uploading ? 'Uploading...' : f.imageUrl ? 'Replace' : 'Upload'}</span>
                </Button>
              </label>
              {f.imageUrl && <span className="text-xs text-green-600">✓ Loaded</span>}
            </div>
          </div>
          {f.imageUrl && (
            <div className="w-16 h-10 border rounded overflow-hidden bg-muted">
              <img src={f.imageUrl} alt="" className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <Label className="text-[10px]">Label</Label>
            <Input value={f.label} onChange={e => updateField(i, { label: e.target.value })} className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Width: {f.width || 15}%</Label>
              <Slider value={[f.width || 15]} onValueChange={v => updateField(i, { width: v[0] })} min={3} max={60} step={0.5} />
            </div>
            <div>
              <Label className="text-[10px]">Height: {f.height || 8}%</Label>
              <Slider value={[f.height || 8]} onValueChange={v => updateField(i, { height: v[0] })} min={2} max={40} step={0.5} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">X: {f.x}%</Label>
              <Slider value={[f.x]} onValueChange={v => updateField(i, { x: v[0] })} min={0} max={100} />
            </div>
            <div>
              <Label className="text-[10px]">Y: {f.y}%</Label>
              <Slider value={[f.y]} onValueChange={v => updateField(i, { y: v[0] })} min={0} max={100} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Opacity: {Math.round((f.opacity ?? 1) * 100)}%</Label>
              <Slider value={[(f.opacity ?? 1) * 100]} onValueChange={v => updateField(i, { opacity: v[0] / 100 })} min={10} max={100} />
            </div>
            <div>
              <Label className="text-[10px]">Rotation: {f.rotation || 0}°</Label>
              <Slider value={[f.rotation || 0]} onValueChange={v => updateField(i, { rotation: v[0] })} min={-45} max={45} />
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => duplicateField(i)}>
              <Copy className="h-3 w-3" /> Duplicate
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive text-xs h-7 gap-1" onClick={(e) => { e.stopPropagation(); removeField(i); }}>
              <Trash2 className="h-3 w-3" /> Remove
            </Button>
          </div>
        </div>
      );
    }

    // Text field editor
    return (
      <div className="mt-3 space-y-3 border-t pt-3">
        {(f.key === 'custom_text' || f.key === 'custom_image') && (
          <div>
            <Label className="text-[10px]">Text Content</Label>
            <Input value={f.value || ''} onChange={e => updateField(i, { value: e.target.value })} className="h-8 text-xs" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">X: {f.x}%</Label>
            <Slider value={[f.x]} onValueChange={v => updateField(i, { x: v[0] })} min={0} max={100} />
          </div>
          <div>
            <Label className="text-[10px]">Y: {f.y}%</Label>
            <Slider value={[f.y]} onValueChange={v => updateField(i, { y: v[0] })} min={0} max={100} />
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Font Family</Label>
          <Select value={f.fontFamily || 'Arial, sans-serif'} onValueChange={(v) => updateField(i, { fontFamily: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">Standard</div>
              {FONT_FAMILIES.slice(0, 4).map(ff => (
                <SelectItem key={ff} value={ff}><span style={{ fontFamily: ff }}>{FONT_LABELS[ff]}</span></SelectItem>
              ))}
              <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold border-t mt-1 pt-1">✍ Handwritten / Calligraphy</div>
              {FONT_FAMILIES.slice(4, 13).map(ff => (
                <SelectItem key={ff} value={ff}><span style={{ fontFamily: ff.replace(/'/g, '') }}>{FONT_LABELS[ff]}</span></SelectItem>
              ))}
              <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold border-t mt-1 pt-1">Elegant Serif</div>
              {FONT_FAMILIES.slice(13).map(ff => (
                <SelectItem key={ff} value={ff}><span style={{ fontFamily: ff.replace(/'/g, '') }}>{FONT_LABELS[ff]}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Font Size</Label>
            <Input type="number" value={f.fontSize} onChange={e => updateField(i, { fontSize: Number(e.target.value) })} className="h-8 text-xs" min={8} max={72} />
          </div>
          <div>
            <Label className="text-[10px]">Color</Label>
            <input type="color" value={f.fontColor} onChange={e => updateField(i, { fontColor: e.target.value })} className="w-full h-8 rounded cursor-pointer" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px]">Weight</Label>
            <Select value={f.fontWeight} onValueChange={(v: any) => updateField(i, { fontWeight: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="semibold">Semi Bold</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Style</Label>
            <Button
              size="sm"
              variant={f.fontStyle === 'italic' ? 'default' : 'outline'}
              className="h-8 w-full text-xs"
              onClick={() => updateField(i, { fontStyle: f.fontStyle === 'italic' ? 'normal' : 'italic' })}
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div>
            <Label className="text-[10px]">Align</Label>
            <div className="flex h-8 border rounded-md overflow-hidden">
              {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([align, Icon]) => (
                <button
                  key={align}
                  className={`flex-1 flex items-center justify-center transition-colors ${(f.textAlign || 'center') === align ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  onClick={() => updateField(i, { textAlign: align })}
                >
                  <Icon className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
        </div>
        {f.opacity != null && (
          <div>
            <Label className="text-[10px]">Opacity: {Math.round((f.opacity ?? 1) * 100)}%</Label>
            <Slider value={[(f.opacity ?? 1) * 100]} onValueChange={v => updateField(i, { opacity: v[0] / 100 })} min={10} max={100} />
          </div>
        )}
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => duplicateField(i)}>
            <Copy className="h-3 w-3" /> Duplicate
          </Button>
          {i > 0 && (
            <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => moveFieldOrder(i, -1)}>↑</Button>
          )}
          {i < fields.length - 1 && (
            <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => moveFieldOrder(i, 1)}>↓</Button>
          )}
          {(f.key === 'custom_text' || f.key === 'custom_image') && (
            <Button size="sm" variant="ghost" className="text-destructive text-xs h-7 gap-1" onClick={(e) => { e.stopPropagation(); removeField(i); }}>
              <Trash2 className="h-3 w-3" /> Remove
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Certificate Management</h2>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="issued">Issued Certificates</TabsTrigger>
        </TabsList>

        {/* ── Templates Tab ── */}
        <TabsContent value="templates" className="space-y-4">
          <Button onClick={() => { resetBuilder(); setActiveTab('builder'); }} className="gap-2">
            <Plus className="h-4 w-4" /> New Template
          </Button>
          {templatesLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-3 text-muted" />
              <p>No templates yet. Create your first certificate template.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates.map((tpl: any) => {
                const assignedCount = courses.filter((c: any) => c.cert_template_id === tpl.id).length;
                return (
                  <div key={tpl.id} className="border rounded-xl p-4 flex items-center gap-4 bg-card hover:shadow-sm transition-shadow">
                    <div className="w-24 h-16 rounded-lg bg-muted overflow-hidden shrink-0 border">
                      {tpl.background_url ? (
                        <img src={tpl.background_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Award className="h-6 w-6" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-heading font-bold text-sm">{tpl.name}</h4>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{tpl.download_rule === 'gradebook_pass' ? `Score ≥ ${tpl.min_score_pct}%` : tpl.download_rule === 'course_complete' ? 'Course Complete' : 'Anytime'}</Badge>
                        <Badge variant="outline" className="text-xs">{assignedCount} course{assignedCount !== 1 ? 's' : ''}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => loadTemplate(tpl)}><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteMutation.mutate(tpl.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Builder Tab ── */}
        <TabsContent value="builder" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            {/* Left Panel */}
            <div className="space-y-4 overflow-y-auto max-h-[85vh] pr-1">
              {/* Template Settings */}
              <div className="bg-card border rounded-xl p-5 space-y-4">
                <h4 className="font-heading font-semibold text-sm">Template Settings</h4>
                <div>
                  <Label className="text-xs">Template Name</Label>
                  <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Classic Gold" />
                </div>
                <div>
                  <Label className="text-xs">Background Image</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleBgUpload} />
                      <Button asChild size="sm" variant="outline" disabled={uploading}>
                        <span><Upload className="h-3.5 w-3.5 mr-1" />{uploading ? 'Uploading...' : 'Upload'}</span>
                      </Button>
                    </label>
                    {backgroundUrl && (
                      <>
                        <span className="text-xs text-green-600">✓ Set</span>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setBackgroundUrl(null)}>Remove</Button>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Download Rule</Label>
                  <Select value={downloadRule} onValueChange={setDownloadRule}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gradebook_pass">Based on Gradebook Score</SelectItem>
                      <SelectItem value="course_complete">Course Completion Only</SelectItem>
                      <SelectItem value="anytime">Always Available</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {downloadRule === 'gradebook_pass' && (
                  <div>
                    <Label className="text-xs">Minimum Score: {minScorePct}%</Label>
                    <Slider value={[minScorePct]} onValueChange={v => setMinScorePct(v[0])} min={10} max={100} step={5} />
                  </div>
                )}
              </div>

              {/* Course assignment */}
              <div className="bg-card border rounded-xl p-5 space-y-3">
                <h4 className="font-heading font-semibold text-sm">Assign to Courses</h4>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {courses.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                      <input type="checkbox" checked={assignedCourses.includes(c.id)} onChange={() => toggleCourseAssignment(c.id)} className="rounded" />
                      <span className="truncate">{c.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Fields */}
              <div className="bg-card border rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading font-semibold text-sm">Elements</h4>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addCustomField}>
                      <Type className="h-3 w-3" /> Text
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addImageField}>
                      <ImageIcon className="h-3 w-3" /> Image
                    </Button>
                  </div>
                </div>
                {fields.map((f, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${selectedField === i ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedField(i)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {f.type === 'image' ? <ImageIcon className="h-3 w-3 text-muted-foreground" /> : <GripVertical className="h-3 w-3 text-muted-foreground" />}
                        <span className="font-medium">{f.label}</span>
                        {f.type === 'image' && <Badge variant="secondary" className="text-[9px] h-4">IMG</Badge>}
                      </div>
                      <Switch checked={f.visible} onCheckedChange={v => updateField(i, { visible: v })} />
                    </div>
                    {selectedField === i && f.visible && renderFieldEditor(f, i)}
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button onClick={() => saveMutation.mutate()} disabled={!templateName || saveMutation.isPending} className="flex-1 gap-2">
                  <Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Save'}
                </Button>
                <Button variant="outline" className="gap-1" onClick={handleSamplePDF}>
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
            </div>

            {/* Right Panel: Visual Preview */}
            <div ref={previewContainerRef} className="flex flex-col">
              <p className="text-xs text-muted-foreground mb-2">
                🖱️ Drag elements to reposition • Drag corners to resize images • Click element to edit
              </p>
              <div className="w-full border-2 border-dashed border-muted-foreground/20 rounded-xl overflow-hidden bg-muted/10 shadow-inner">
                <canvas
                  ref={canvasRef}
                  className="w-full"
                  style={{ aspectRatio: '1122/793', cursor: resizing ? 'nwse-resize' : dragging !== null ? 'grabbing' : 'grab' }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Preview shows how the certificate will look. Download a sample PDF to verify.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* ── Issued Certificates Tab ── */}
        <TabsContent value="issued" className="space-y-4">
          {certsLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : issuedCerts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-3 text-muted" />
              <p>No certificates have been issued yet.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate #</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Downloads</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuedCerts.map((cert: any) => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-mono text-xs">{cert.certificate_number}</TableCell>
                      <TableCell>{cert.user_profiles?.full_name || 'Student'}</TableCell>
                      <TableCell className="text-muted-foreground">{cert.courses?.title || '—'}</TableCell>
                      <TableCell className="text-center">
                        {cert.score_percentage != null ? (
                          <Badge variant={Number(cert.score_percentage) >= 80 ? 'default' : 'secondary'}>{cert.score_percentage}%</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-center">{cert.download_count || 0}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {cert.issued_at ? format(new Date(cert.issued_at), 'MMM dd, yyyy') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCertificates;

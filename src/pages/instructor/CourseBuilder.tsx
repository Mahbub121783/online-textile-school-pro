import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Eye, ChevronDown, Check } from 'lucide-react';
import RichTextEditor from '@/components/instructor/RichTextEditor';
import MediaUploader from '@/components/instructor/MediaUploader';
import CurriculumBuilder from '@/components/instructor/CurriculumBuilder';

const steps = ['Basics', 'Curriculum', 'Settings'];

const CourseBuilder = () => {
  const { courseId } = useParams();
  const isNew = !courseId || courseId === 'new';
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [optionsTab, setOptionsTab] = useState('general');

  const [form, setForm] = useState({
    title: '', slug: '', short_description: '', description: '', difficulty_level: 'beginner',
    language: 'en', price: '0', discount_price: '', category_id: '', thumbnail_url: '',
    intro_video_url: '', meta_title: '', meta_description: '', og_image_url: '',
    max_students: '', is_public: true, content_drip_enabled: false,
    certificate_threshold_pct: '100', revenue_share_pct: '70',
    review_status: 'draft', cert_template_id: '',
  });
  const [certSearch, setCertSearch] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('sort_order');
      return data ?? [];
    },
  });

  const { data: certTemplates = [] } = useQuery({
    queryKey: ['cert-templates-for-builder'],
    queryFn: async () => {
      const { data } = await supabase.from('certificate_templates').select('id, name, background_url, download_rule, min_score_pct').order('name');
      return data ?? [];
    },
  });

  const { data: course } = useQuery({
    queryKey: ['instructor-course', courseId],
    enabled: !isNew,
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('*').eq('id', courseId!).single();
      return data;
    },
  });

  useEffect(() => {
    if (course) {
      setForm({
        title: course.title || '', slug: course.slug || '',
        short_description: course.short_description || '', description: course.description || '',
        difficulty_level: course.difficulty_level || 'beginner', language: course.language || 'en',
        price: String(course.price ?? 0), discount_price: course.discount_price ? String(course.discount_price) : '',
        category_id: course.category_id ? String(course.category_id) : '',
        thumbnail_url: course.thumbnail_url || '', intro_video_url: course.intro_video_url || '',
        meta_title: course.meta_title || '', meta_description: course.meta_description || '',
        og_image_url: course.og_image_url || '',
        max_students: (course as any).max_students ? String((course as any).max_students) : '',
        is_public: (course as any).is_public !== false,
        content_drip_enabled: (course as any).content_drip_enabled || false,
        certificate_threshold_pct: String(course.certificate_threshold_pct ?? 100),
        revenue_share_pct: String(course.revenue_share_pct ?? 70),
        review_status: course.review_status || 'draft',
        cert_template_id: course.cert_template_id || '',
      });
    }
  }, [course]);

  const generateSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const update = (field: string, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && (isNew || !prev.slug)) next.slug = generateSlug(value);
      return next;
    });
  };

  const isFree = Number(form.price) === 0;

  const handleSave = async (status?: string) => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    const payload: any = {
      title: form.title, slug: form.slug || generateSlug(form.title),
      short_description: form.short_description || null, description: form.description || null,
      difficulty_level: form.difficulty_level, language: form.language,
      price: Number(form.price) || 0, discount_price: form.discount_price ? Number(form.discount_price) : null,
      category_id: form.category_id ? Number(form.category_id) : null,
      thumbnail_url: form.thumbnail_url || null, intro_video_url: form.intro_video_url || null,
      meta_title: form.meta_title || null, meta_description: form.meta_description || null,
      og_image_url: form.og_image_url || null,
      max_students: form.max_students ? Number(form.max_students) : null,
      is_public: form.is_public, content_drip_enabled: form.content_drip_enabled,
      certificate_threshold_pct: Number(form.certificate_threshold_pct) || 100,
      revenue_share_pct: Number(form.revenue_share_pct) || 70,
      cert_template_id: form.cert_template_id || null,
      instructor_id: course?.instructor_id || user!.id,
    };
    if (status) payload.review_status = status;
    if (status === 'approved') payload.is_published = true;

    if (isNew) {
      const { data, error } = await supabase.from('courses').insert(payload).select().single();
      if (error) { toast.error(error.message); } else { toast.success('Course created!'); navigate(`/instructor/courses/${data.id}`, { replace: true }); }
    } else {
      const { error } = await supabase.from('courses').update(payload).eq('id', courseId!);
      if (error) { toast.error(error.message); } else { toast.success('Course saved!'); qc.invalidateQueries({ queryKey: ['instructor-course', courseId] }); }
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen -m-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-card border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Progress stepper */}
            <div className="flex items-center gap-1">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <button
                    onClick={() => { if (i === 1 && isNew) return; setStep(i); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      i === step ? 'bg-primary text-primary-foreground' :
                      i < step ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    } ${i === 1 && isNew ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : <span className="text-xs">{i + 1}</span>}
                    <span className="hidden sm:inline">{s}</span>
                  </button>
                  {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.open(`/courses/${form.slug}`, '_blank')}>
                <Eye className="h-4 w-4" /> Preview
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-accent hover:bg-accent-hover text-accent-foreground gap-1.5" disabled={saving}>
                  {saving ? 'Saving...' : 'Publish'} <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSave('draft')}>Save as Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSave('pending')}>Submit for Review</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSave('approved')}>Publish Now</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="p-6 bg-secondary/30 min-h-[calc(100vh-60px)]">
        {/* Step 1: Basics */}
        {step === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Left column */}
            <div className="space-y-6">
              <div className="bg-card border rounded-xl p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Course Title *</Label>
                  <Input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Advanced Industrial Weaving" className="text-lg h-12" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Permalink: /courses/{form.slug || 'your-course-slug'}</Label>
                  <Input value={form.slug} onChange={(e) => update('slug', e.target.value)} placeholder="auto-generated" className="text-sm h-9" />
                </div>
              </div>

              <div className="bg-card border rounded-xl p-6 space-y-2">
                <Label className="text-sm font-semibold">Course Description</Label>
                <RichTextEditor value={form.description} onChange={(v) => update('description', v)} placeholder="Write a detailed course description..." minHeight="250px" />
              </div>

              {/* Options box with vertical tabs */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="flex">
                  <div className="w-40 border-r bg-muted/30 shrink-0">
                    {['general', 'drip', 'pricing'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setOptionsTab(t)}
                        className={`w-full text-left px-4 py-3 text-sm font-medium border-b transition-colors ${
                          optionsTab === t ? 'bg-card text-primary border-l-2 border-l-primary' : 'text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {t === 'general' ? 'General' : t === 'drip' ? 'Content Drip' : 'Pricing'}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 p-6">
                    {optionsTab === 'general' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Maximum Students</Label>
                            <Input type="number" value={form.max_students} onChange={(e) => update('max_students', e.target.value)} placeholder="Unlimited" />
                          </div>
                          <div className="space-y-2">
                            <Label>Difficulty Level</Label>
                            <Select value={form.difficulty_level} onValueChange={(v) => update('difficulty_level', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={form.category_id} onValueChange={(v) => update('category_id', v)}>
                              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                              <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Language</Label>
                            <Select value={form.language} onValueChange={(v) => update('language', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="bn">Bangla</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                    {optionsTab === 'drip' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Switch checked={form.content_drip_enabled} onCheckedChange={(v) => update('content_drip_enabled', v)} />
                          <div>
                            <Label className="font-medium">Enable Content Drip</Label>
                            <p className="text-xs text-muted-foreground">Release course content gradually</p>
                          </div>
                        </div>
                        {form.content_drip_enabled && (
                          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">Content drip scheduling will be available after publishing.</p>
                        )}
                      </div>
                    )}
                    {optionsTab === 'pricing' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${isFree ? 'border-primary bg-primary/5' : ''}`}>
                            <input type="radio" checked={isFree} onChange={() => update('price', '0')} className="accent-primary" /> Free
                          </label>
                          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${!isFree ? 'border-primary bg-primary/5' : ''}`}>
                            <input type="radio" checked={!isFree} onChange={() => { if (isFree) update('price', '500'); }} className="accent-primary" /> Paid
                          </label>
                        </div>
                        {!isFree && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Regular Price (৳)</Label>
                              <Input type="number" value={form.price} onChange={(e) => update('price', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>Sale Price (৳)</Label>
                              <Input type="number" value={form.discount_price} onChange={(e) => update('discount_price', e.target.value)} placeholder="Optional" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <div className="bg-card border rounded-xl p-5 space-y-4">
                <h4 className="font-heading font-semibold text-sm">Visibility</h4>
                <Select value={form.is_public ? 'public' : 'private'} onValueChange={(v) => update('is_public', v === 'public')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  Status: <span className="font-medium capitalize">{form.review_status}</span>
                </div>
              </div>

              <div className="bg-card border rounded-xl p-5 space-y-3">
                <h4 className="font-heading font-semibold text-sm">Featured Image</h4>
                <MediaUploader value={form.thumbnail_url} onChange={(v) => update('thumbnail_url', v)} label="Upload featured image" aspectRatio="16/9" />
              </div>

              <div className="bg-card border rounded-xl p-5 space-y-3">
                <h4 className="font-heading font-semibold text-sm">Intro Video</h4>
                <Input value={form.intro_video_url} onChange={(e) => update('intro_video_url', e.target.value)} placeholder="YouTube or Vimeo URL" className="text-sm" />
                <p className="text-xs text-muted-foreground">Or upload a video file:</p>
                <MediaUploader value="" onChange={(v) => update('intro_video_url', v)} accept="video/*" label="Upload Video" />
              </div>

              <div className="bg-card border rounded-xl p-5 space-y-3">
                <h4 className="font-heading font-semibold text-sm">Short Description</h4>
                <textarea
                  value={form.short_description}
                  onChange={(e) => update('short_description', e.target.value)}
                  rows={3}
                  placeholder="Brief summary shown on cards"
                  className="w-full text-sm border rounded-lg p-3 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Curriculum */}
        {step === 1 && !isNew && (
          <div className="max-w-4xl mx-auto">
            <CurriculumBuilder courseId={courseId!} />
          </div>
        )}

        {step === 1 && isNew && (
          <div className="max-w-4xl mx-auto text-center py-16">
            <p className="text-muted-foreground">Please save the course first to start building curriculum.</p>
            <Button className="mt-4 bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => handleSave('draft')}>Save & Continue</Button>
          </div>
        )}

        {/* Step 3: Settings */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 max-w-5xl mx-auto">
            <div className="space-y-6">
              <div className="bg-card border rounded-xl p-6 space-y-4">
                <h4 className="font-heading font-semibold">SEO Settings</h4>
                <div className="space-y-2">
                  <Label>Meta Title</Label>
                  <Input value={form.meta_title} onChange={(e) => update('meta_title', e.target.value)} placeholder="SEO title (max 60 chars)" maxLength={60} />
                </div>
                <div className="space-y-2">
                  <Label>Meta Description</Label>
                  <textarea
                    value={form.meta_description}
                    onChange={(e) => update('meta_description', e.target.value)}
                    placeholder="SEO description (max 160 chars)"
                    maxLength={160}
                    rows={3}
                    className="w-full text-sm border rounded-lg p-3 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label>OG Image</Label>
                  <MediaUploader value={form.og_image_url} onChange={(v) => update('og_image_url', v)} label="Upload OG image" aspectRatio="1200/630" />
                </div>
              </div>

              <div className="bg-card border rounded-xl p-6 space-y-4">
                <h4 className="font-heading font-semibold">Certificate</h4>
                <div className="space-y-2">
                  <Label>Certificate Template</Label>
                  <Input
                    placeholder="Search templates..."
                    value={certSearch}
                    onChange={(e) => setCertSearch(e.target.value)}
                    className="text-sm h-9"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-lg p-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5">
                      <input type="radio" checked={!form.cert_template_id} onChange={() => update('cert_template_id', '')} className="accent-primary" />
                      <span className="text-muted-foreground">No certificate</span>
                    </label>
                    {certTemplates
                      .filter((t: any) => !certSearch || t.name.toLowerCase().includes(certSearch.toLowerCase()))
                      .map((t: any) => (
                        <label key={t.id} className={`flex items-center gap-3 text-sm cursor-pointer rounded px-2 py-1.5 transition-colors ${form.cert_template_id === t.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`}>
                          <input type="radio" checked={form.cert_template_id === t.id} onChange={() => update('cert_template_id', t.id)} className="accent-primary" />
                          <div className="w-10 h-7 rounded bg-muted overflow-hidden shrink-0 border">
                            {t.background_url ? <img src={t.background_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">📜</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{t.name}</span>
                            <span className="text-[10px] text-muted-foreground">{t.download_rule === 'gradebook_pass' ? `Score ≥ ${t.min_score_pct}%` : t.download_rule === 'course_complete' ? 'Course Complete' : 'Anytime'}</span>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Completion Threshold (%)</Label>
                  <Input type="number" value={form.certificate_threshold_pct} onChange={(e) => update('certificate_threshold_pct', e.target.value)} min={0} max={100} />
                  <p className="text-xs text-muted-foreground">Students must complete this percentage to earn a certificate.</p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-card border rounded-xl p-6 space-y-4">
                <h4 className="font-heading font-semibold">Revenue</h4>
                <div className="space-y-2">
                  <Label>Revenue Share (%)</Label>
                  <Input type="number" value={form.revenue_share_pct} onChange={(e) => update('revenue_share_pct', e.target.value)} min={0} max={100} />
                  <p className="text-xs text-muted-foreground">Instructor's share of course revenue.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseBuilder;

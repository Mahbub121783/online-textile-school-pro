import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

interface SectionEditor {
  pageKey: string;
  sectionKey: string;
  label: string;
  type: 'text' | 'textarea' | 'json';
  description?: string;
}

const SECTIONS: SectionEditor[] = [
  // About page
  { pageKey: 'about', sectionKey: 'hero_title', label: 'Hero Title', type: 'text' },
  { pageKey: 'about', sectionKey: 'hero_description', label: 'Hero Description', type: 'textarea' },
  { pageKey: 'about', sectionKey: 'mission', label: 'Mission Statement', type: 'textarea' },
  { pageKey: 'about', sectionKey: 'vision', label: 'Vision Statement', type: 'textarea' },
  { pageKey: 'about', sectionKey: 'why_choose_us', label: 'Why Choose Us (JSON array of strings)', type: 'json', description: 'Array of bullet points, e.g. ["Point 1","Point 2"]' },
  { pageKey: 'about', sectionKey: 'stats', label: 'Stats (JSON array)', type: 'json', description: 'e.g. [{"label":"Students","value":"5000+","icon":"Users"}]' },
  // Contact page
  { pageKey: 'contact', sectionKey: 'hero_title', label: 'Hero Title', type: 'text' },
  { pageKey: 'contact', sectionKey: 'hero_description', label: 'Hero Description', type: 'textarea' },
  { pageKey: 'contact', sectionKey: 'address', label: 'Address', type: 'text' },
  // Departments page
  { pageKey: 'departments', sectionKey: 'hero_title', label: 'Hero Title', type: 'text' },
  { pageKey: 'departments', sectionKey: 'hero_description', label: 'Hero Description', type: 'textarea' },
  { pageKey: 'departments', sectionKey: 'departments_list', label: 'Departments (JSON array)', type: 'json', description: 'e.g. [{"name":"Textile Engineering","description":"...","slug":"textile-engineering","color":"from-blue-500/20 to-blue-600/10"}]' },
];

const PAGES = [
  { key: 'about', label: 'About Page' },
  { key: 'contact', label: 'Contact Page' },
  { key: 'departments', label: 'Departments Page' },
];

const AdminSiteContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: content = [] } = useQuery({
    queryKey: ['admin-site-content'],
    queryFn: async () => {
      const { data } = await supabase.from('site_content').select('*');
      return data ?? [];
    },
  });

  useEffect(() => {
    if (content.length > 0) {
      const map: Record<string, string> = {};
      content.forEach((row: any) => {
        const key = `${row.page_key}::${row.section_key}`;
        map[key] = typeof row.content === 'string' ? row.content : JSON.stringify(row.content, null, 2);
      });
      setValues(map);
    }
  }, [content]);

  const saveMutation = useMutation({
    mutationFn: async ({ pageKey, sectionKey }: { pageKey: string; sectionKey: string }) => {
      const raw = values[`${pageKey}::${sectionKey}`] || '';
      let parsed: any;
      const section = SECTIONS.find(s => s.pageKey === pageKey && s.sectionKey === sectionKey);
      if (section?.type === 'json') {
        try { parsed = JSON.parse(raw); } catch { throw new Error('Invalid JSON'); }
      } else {
        parsed = raw;
      }

      const { error } = await supabase
        .from('site_content')
        .upsert(
          { page_key: pageKey, section_key: sectionKey, content: parsed, updated_by: user?.id },
          { onConflict: 'page_key,section_key' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-site-content'] });
      queryClient.invalidateQueries({ queryKey: ['site-content'] });
      toast.success('Content saved');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save'),
  });

  const getValue = (pageKey: string, sectionKey: string) => values[`${pageKey}::${sectionKey}`] || '';
  const setValue = (pageKey: string, sectionKey: string, val: string) => {
    setValues(prev => ({ ...prev, [`${pageKey}::${sectionKey}`]: val }));
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold">Site Content</h2>
      <p className="text-sm text-muted-foreground">Edit content for static pages. Changes appear on the public site immediately after saving.</p>

      <Tabs defaultValue="about">
        <TabsList>
          {PAGES.map(p => (
            <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>
          ))}
        </TabsList>

        {PAGES.map(page => (
          <TabsContent key={page.key} value={page.key} className="space-y-4 mt-4">
            {SECTIONS.filter(s => s.pageKey === page.key).map(section => (
              <Card key={section.sectionKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{section.label}</CardTitle>
                  {section.description && <p className="text-xs text-muted-foreground">{section.description}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {section.type === 'text' ? (
                    <Input
                      value={getValue(section.pageKey, section.sectionKey)}
                      onChange={e => setValue(section.pageKey, section.sectionKey, e.target.value)}
                    />
                  ) : (
                    <Textarea
                      rows={section.type === 'json' ? 6 : 3}
                      className={section.type === 'json' ? 'font-mono text-sm' : ''}
                      value={getValue(section.pageKey, section.sectionKey)}
                      onChange={e => setValue(section.pageKey, section.sectionKey, e.target.value)}
                    />
                  )}
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate({ pageKey: section.pageKey, sectionKey: section.sectionKey })}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="h-3 w-3 mr-1" /> Save
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminSiteContent;

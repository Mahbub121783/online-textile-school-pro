import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Bot, Settings, BookOpen, Plus, Trash2, Save, Brain, Database, Key, Eye, EyeOff, MessageSquare, RefreshCw, Search, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AiConfig {
  id: string;
  provider: string;
  api_key: string | null;
  model_name: string;
  system_prompt: string;
  is_active: boolean;
  max_tokens: number;
  temperature: number;
  knowledge_base: { topic: string; content: string }[];
  db_context_enabled: boolean;
}

interface ApiKey {
  id: string;
  provider: string;
  api_key: string;
  label: string;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  last_error: string | null;
  error_count: number;
  created_at: string;
}

interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  created_at: string;
  user_profiles?: { full_name: string } | null;
}

interface IndexStats {
  entity_type: string;
  count: number;
}

const PROVIDERS = [
  { value: 'lovable', label: 'Lovable AI (Default)', description: 'Pre-configured, no API key needed' },
  { value: 'openai', label: 'OpenAI (ChatGPT)', description: 'GPT-4o, GPT-4o-mini' },
  { value: 'groq', label: 'Groq', description: 'Llama 3.3, Mixtral - Ultra fast' },
  { value: 'mistral', label: 'Mistral AI', description: 'Mistral Small/Large' },
  { value: 'gemini', label: 'Google Gemini', description: 'Gemini 2.5 Pro/Flash' },
];

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  lovable: [
    { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (Fast)' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Best)' },
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'openai/gpt-5', label: 'GPT-5' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fast)' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  ],
  mistral: [
    { value: 'mistral-large-latest', label: 'Mistral Large' },
    { value: 'mistral-small-latest', label: 'Mistral Small' },
    { value: 'open-mistral-nemo', label: 'Mistral Nemo' },
  ],
  gemini: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ],
};

const AdminAiChatbot = () => {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [indexStats, setIndexStats] = useState<IndexStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [newKb, setNewKb] = useState({ topic: '', content: '' });
  const [kbDialogOpen, setKbDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState({ provider: 'groq', api_key: '', label: '' });
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [showKeyValues, setShowKeyValues] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [configRes, sessionsRes, keysRes] = await Promise.all([
      supabase.from('ai_chatbot_config').select('*').order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('ai_chat_sessions').select('*, user_profiles:user_id(full_name)').order('updated_at', { ascending: false }).limit(50),
      supabase.from('ai_api_keys').select('*').order('created_at', { ascending: false }),
    ]);
    if (configRes.data) setConfig(configRes.data as any);
    if (sessionsRes.data) setSessions(sessionsRes.data as any);
    if (keysRes.data) setApiKeys(keysRes.data as any);
    await fetchIndexStats();
    setLoading(false);
  };

  const fetchIndexStats = async () => {
    const { data } = await supabase.from('ai_search_index').select('entity_type');
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((r: any) => { counts[r.entity_type] = (counts[r.entity_type] || 0) + 1; });
      setIndexStats(Object.entries(counts).map(([entity_type, count]) => ({ entity_type, count })));
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { id, ...data } = config;
    const { error } = await supabase.from('ai_chatbot_config').update(data).eq('id', id);
    if (error) toast.error(error.message);
    else toast.success('AI configuration saved!');
    setSaving(false);
  };

  const addKnowledge = () => {
    if (!newKb.topic || !newKb.content || !config) return;
    setConfig({ ...config, knowledge_base: [...config.knowledge_base, { topic: newKb.topic, content: newKb.content }] });
    setNewKb({ topic: '', content: '' });
    setKbDialogOpen(false);
    toast.success('Knowledge entry added. Save to apply.');
  };

  const removeKnowledge = (index: number) => {
    if (!config) return;
    setConfig({ ...config, knowledge_base: config.knowledge_base.filter((_, i) => i !== index) });
    toast.info('Entry removed. Save to apply.');
  };

  const deleteSession = async (id: string) => {
    await supabase.from('ai_chat_sessions').delete().eq('id', id);
    setSessions(prev => prev.filter(s => s.id !== id));
    toast.success('Session deleted');
  };

  const addApiKey = async () => {
    if (!newKey.api_key || !newKey.label) return;
    const { error } = await supabase.from('ai_api_keys').insert({
      provider: newKey.provider,
      api_key: newKey.api_key,
      label: newKey.label,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('API key added!');
      setNewKey({ provider: 'groq', api_key: '', label: '' });
      setKeyDialogOpen(false);
      const { data } = await supabase.from('ai_api_keys').select('*').order('created_at', { ascending: false });
      if (data) setApiKeys(data as any);
    }
  };

  const toggleApiKey = async (id: string, active: boolean) => {
    await supabase.from('ai_api_keys').update({ is_active: active }).eq('id', id);
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: active } : k));
  };

  const deleteApiKey = async (id: string) => {
    await supabase.from('ai_api_keys').delete().eq('id', id);
    setApiKeys(prev => prev.filter(k => k.id !== id));
    toast.success('API key deleted');
  };

  const rebuildIndex = async () => {
    setIndexing(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-index-builder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      const result = await resp.json();
      if (result.success) {
        toast.success(`Index rebuilt! ${result.indexed}/${result.total} entries indexed.`);
        await fetchIndexStats();
      } else {
        toast.error(result.error || 'Index build failed');
      }
    } catch (e) {
      toast.error('Failed to rebuild index');
    }
    setIndexing(false);
  };

  if (loading) return <div className="animate-pulse text-muted-foreground p-8">Loading AI configuration...</div>;
  if (!config) return <div className="text-muted-foreground p-8">No AI configuration found.</div>;

  const models = PROVIDER_MODELS[config.provider] || PROVIDER_MODELS.lovable;
  const totalIndexed = indexStats.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6" /> AI Chatbot Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure AI provider, API keys, knowledge base, search index & sessions</p>
        </div>
        <Button onClick={saveConfig} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="flex-wrap">
          <TabsTrigger value="config"><Settings className="h-4 w-4 mr-1" /> Config</TabsTrigger>
          <TabsTrigger value="apikeys"><Key className="h-4 w-4 mr-1" /> API Keys ({apiKeys.length})</TabsTrigger>
          <TabsTrigger value="knowledge"><BookOpen className="h-4 w-4 mr-1" /> Knowledge ({config.knowledge_base.length})</TabsTrigger>
          <TabsTrigger value="index"><Search className="h-4 w-4 mr-1" /> Index ({totalIndexed})</TabsTrigger>
          <TabsTrigger value="sessions"><MessageSquare className="h-4 w-4 mr-1" /> Sessions ({sessions.length})</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Brain className="h-5 w-5" /> AI Provider</CardTitle>
                <CardDescription>Primary provider (rolling keys override per-provider)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Provider</Label>
                  <Select value={config.provider} onValueChange={v => setConfig({ ...config, provider: v, model_name: PROVIDER_MODELS[v]?.[0]?.value || '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          <span className="font-medium">{p.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{p.description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Model</Label>
                  <Select value={config.model_name} onValueChange={v => setConfig({ ...config, model_name: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {models.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {config.provider !== 'lovable' && (
                  <div>
                    <Label className="flex items-center gap-2"><Key className="h-3.5 w-3.5" /> Fallback API Key</Label>
                    <div className="flex gap-2">
                      <Input type={showApiKey ? 'text' : 'password'} value={config.api_key || ''} onChange={e => setConfig({ ...config, api_key: e.target.value })} placeholder="Used when no rolling keys available" />
                      <Button variant="ghost" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Settings className="h-5 w-5" /> Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div><Label>Active</Label><p className="text-xs text-muted-foreground">Enable/disable AI tutor</p></div>
                  <Switch checked={config.is_active} onCheckedChange={v => setConfig({ ...config, is_active: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label className="flex items-center gap-1"><Database className="h-3.5 w-3.5" /> DB Context</Label><p className="text-xs text-muted-foreground">Access student data for personalized answers</p></div>
                  <Switch checked={config.db_context_enabled} onCheckedChange={v => setConfig({ ...config, db_context_enabled: v })} />
                </div>
                <div>
                  <Label>Temperature: {config.temperature}</Label>
                  <Slider value={[config.temperature]} onValueChange={([v]) => setConfig({ ...config, temperature: v })} min={0} max={1} step={0.1} className="mt-2" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Precise</span><span>Creative</span></div>
                </div>
                <div>
                  <Label>Max Tokens: {config.max_tokens}</Label>
                  <Slider value={[config.max_tokens]} onValueChange={([v]) => setConfig({ ...config, max_tokens: v })} min={256} max={8192} step={256} className="mt-2" />
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-lg">System Prompt</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={config.system_prompt} onChange={e => setConfig({ ...config, system_prompt: e.target.value })} rows={8} className="font-mono text-sm" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="apikeys" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Rolling API Keys</CardTitle>
                <CardDescription>Add multiple keys per provider. System rotates automatically to avoid rate limits.</CardDescription>
              </div>
              <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Key</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add API Key</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Provider</Label>
                      <Select value={newKey.provider} onValueChange={v => setNewKey(p => ({ ...p, provider: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROVIDERS.filter(p => p.value !== 'lovable').map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Label</Label><Input value={newKey.label} onChange={e => setNewKey(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Groq Key #1" /></div>
                    <div><Label>API Key</Label><Input type="password" value={newKey.api_key} onChange={e => setNewKey(p => ({ ...p, api_key: e.target.value }))} placeholder="sk-..." /></div>
                    <Button onClick={addApiKey} className="w-full">Add Key</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No rolling keys configured. The system will use the fallback config key.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map(k => (
                      <TableRow key={k.id}>
                        <TableCell><Badge variant="outline">{k.provider}</Badge></TableCell>
                        <TableCell className="font-medium">{k.label}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {showKeyValues[k.id] ? k.api_key : '••••••••' + (k.api_key?.slice(-4) || '')}
                          <button className="ml-1 text-muted-foreground" onClick={() => setShowKeyValues(p => ({ ...p, [k.id]: !p[k.id] }))}>
                            {showKeyValues[k.id] ? <EyeOff className="h-3 w-3 inline" /> : <Eye className="h-3 w-3 inline" />}
                          </button>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{k.usage_count}</Badge></TableCell>
                        <TableCell>
                          {k.last_error ? (
                            <span className="flex items-center gap-1 text-destructive text-xs"><AlertCircle className="h-3 w-3" />{k.error_count} errors</span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3 w-3" />Healthy</span>
                          )}
                        </TableCell>
                        <TableCell><Switch checked={k.is_active} onCheckedChange={v => toggleApiKey(k.id, v)} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteApiKey(k.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Textile Knowledge Base</CardTitle>
                <CardDescription>Domain knowledge entries injected as AI context</CardDescription>
              </div>
              <Dialog open={kbDialogOpen} onOpenChange={setKbDialogOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Entry</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Knowledge Entry</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Topic</Label><Input value={newKb.topic} onChange={e => setNewKb(p => ({ ...p, topic: e.target.value }))} placeholder="e.g. Fiber Classification" /></div>
                    <div><Label>Content</Label><Textarea value={newKb.content} onChange={e => setNewKb(p => ({ ...p, content: e.target.value }))} rows={5} placeholder="Detailed knowledge..." /></div>
                    <Button onClick={addKnowledge} className="w-full">Add Entry</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {config.knowledge_base.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No knowledge entries yet.</p>
              ) : (
                <div className="space-y-3">
                  {config.knowledge_base.map((kb, i) => (
                    <div key={i} className="border rounded-lg p-3 group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Badge variant="secondary" className="mb-1">{kb.topic}</Badge>
                          <p className="text-sm text-muted-foreground line-clamp-2">{kb.content}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 shrink-0" onClick={() => removeKnowledge(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Index Tab */}
        <TabsContent value="index" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2"><Search className="h-5 w-5" /> Search Index</CardTitle>
                <CardDescription>Platform content indexed for AI context. Rebuild after adding courses/ebooks.</CardDescription>
              </div>
              <Button onClick={rebuildIndex} disabled={indexing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${indexing ? 'animate-spin' : ''}`} />
                {indexing ? 'Building...' : 'Rebuild Index'}
              </Button>
            </CardHeader>
            <CardContent>
              {indexStats.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No content indexed yet. Click "Rebuild Index" to scan all platform content.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {indexStats.map(s => (
                    <div key={s.entity_type} className="border rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold">{s.count}</p>
                      <p className="text-sm text-muted-foreground capitalize">{s.entity_type}s</p>
                    </div>
                  ))}
                  <div className="border rounded-lg p-4 text-center bg-muted">
                    <p className="text-2xl font-bold">{totalIndexed}</p>
                    <p className="text-sm text-muted-foreground">Total Indexed</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Chat Sessions</CardTitle>
              <CardDescription>Monitor student interactions with the AI tutor</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{(s as any).user_profiles?.full_name || 'Unknown'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{s.title}</TableCell>
                      <TableCell><Badge variant="secondary">{Array.isArray(s.messages) ? s.messages.length : 0}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteSession(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sessions.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No chat sessions yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAiChatbot;

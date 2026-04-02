import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Pin, Gift, Trophy, FolderOpen, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AdminForum = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newCatName, setNewCatName] = useState('');
  const [rewardUserId, setRewardUserId] = useState('');
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardReason, setRewardReason] = useState('');
  const [rewardOpen, setRewardOpen] = useState(false);

  // Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('forum_categories').select('*').order('sort_order');
      return data || [];
    },
  });

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const slug = newCatName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { error } = await supabase.from('forum_categories').insert({ name: newCatName.trim(), slug, sort_order: categories.length });
    if (error) return toast.error(error.message);
    toast.success('Category added');
    setNewCatName('');
    qc.invalidateQueries({ queryKey: ['forum-categories'] });
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await supabase.from('forum_categories').delete().eq('id', id);
    toast.success('Category deleted');
    qc.invalidateQueries({ queryKey: ['forum-categories'] });
  };

  // Posts
  const { data: posts = [] } = useQuery({
    queryKey: ['admin-forum-posts'],
    queryFn: async () => {
      const { data } = await supabase.from('forum_posts').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  const postUserIds = [...new Set(posts.map((p: any) => p.user_id))];
  const { data: postProfiles = [] } = useQuery({
    queryKey: ['admin-forum-profiles', postUserIds.join(',')],
    enabled: postUserIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name').in('id', postUserIds);
      return data || [];
    },
  });
  const profMap: Record<string, string> = {};
  postProfiles.forEach((p: any) => { profMap[p.id] = p.full_name; });

  const togglePin = async (id: string, current: boolean) => {
    await supabase.from('forum_posts').update({ is_pinned: !current }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['admin-forum-posts'] });
    toast.success(current ? 'Unpinned' : 'Pinned');
  };

  const deletePost = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    await supabase.from('forum_posts').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['admin-forum-posts'] });
    toast.success('Post deleted');
  };

  // Leaderboard
  const { data: leaderboard = [] } = useQuery({
    queryKey: ['forum-leaderboard-full'],
    queryFn: async () => {
      const { data: points } = await supabase.from('forum_contributor_points').select('user_id, points');
      const { data: rewards } = await supabase.from('forum_rewards').select('user_id, points');
      const map: Record<string, number> = {};
      (points || []).forEach((p: any) => { map[p.user_id] = (map[p.user_id] || 0) + p.points; });
      (rewards || []).forEach((r: any) => { map[r.user_id] = (map[r.user_id] || 0) + r.points; });
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
      const ids = sorted.map(s => s[0]);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', ids);
      return sorted.map(([uid, pts], idx) => {
        const prof = (profs || []).find((p: any) => p.id === uid);
        return { user_id: uid, points: pts, rank: idx + 1, full_name: prof?.full_name || 'User', avatar_url: prof?.avatar_url };
      });
    },
  });

  const grantReward = async () => {
    if (!rewardUserId || !rewardPoints) return;
    const { error } = await supabase.from('forum_rewards').insert({
      user_id: rewardUserId, granted_by: user!.id, points: parseInt(rewardPoints), reason: rewardReason,
    });
    if (error) return toast.error(error.message);
    toast.success('Reward granted!');
    setRewardOpen(false);
    setRewardUserId('');
    setRewardPoints('');
    setRewardReason('');
    qc.invalidateQueries({ queryKey: ['forum-leaderboard-full'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> Forum Management
        </h1>
      </div>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">{p.title}</TableCell>
                    <TableCell className="text-sm">{profMap[p.user_id] || 'Unknown'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</TableCell>
                    <TableCell>{p.view_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.is_pinned && <Badge variant="default" className="text-[10px]">Pinned</Badge>}
                        {p.is_closed && <Badge variant="secondary" className="text-[10px]">Closed</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => togglePin(p.id, p.is_pinned)}>
                          <Pin className={`h-4 w-4 ${p.is_pinned ? 'text-primary' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePost(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><FolderOpen className="h-5 w-5" /> Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="New category name..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                <Button onClick={addCategory} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
              </div>
              <div className="space-y-2">
                {categories.map((cat: any) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">/{cat.slug}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> Contributor Leaderboard</CardTitle>
              <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Gift className="h-4 w-4" /> Grant Reward</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Grant Reward Points</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Select User</Label>
                      <select className="w-full border rounded-md p-2 text-sm bg-background" value={rewardUserId} onChange={(e) => setRewardUserId(e.target.value)}>
                        <option value="">Select...</option>
                        {leaderboard.map((l: any) => (
                          <option key={l.user_id} value={l.user_id}>{l.full_name} ({l.points} pts)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Points</Label>
                      <Input type="number" value={rewardPoints} onChange={(e) => setRewardPoints(e.target.value)} placeholder="50" />
                    </div>
                    <div>
                      <Label>Reason</Label>
                      <Textarea value={rewardReason} onChange={(e) => setRewardReason(e.target.value)} placeholder="Helpful contribution..." />
                    </div>
                    <Button className="w-full" onClick={grantReward}>Grant Reward</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Badge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry: any) => (
                    <TableRow key={entry.user_id}>
                      <TableCell className="font-bold">#{entry.rank}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={entry.avatar_url} />
                            <AvatarFallback className="text-[10px]">{entry.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{entry.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{entry.points} pts</Badge></TableCell>
                      <TableCell>
                        {entry.rank === 1 ? '🥇 Gold' : entry.rank === 2 ? '🥈 Silver' : entry.rank === 3 ? '🥉 Bronze' : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminForum;

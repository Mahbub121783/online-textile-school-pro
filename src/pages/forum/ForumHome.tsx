import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, MessageSquare, Heart, Eye, Pin, Lock, Trophy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import SEOHead from '@/components/SEOHead';

const EMOJIS = ['❤️', '👍', '🎉', '🔥', '💡'];

const ForumHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: categories = [] } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('forum_categories').select('*').order('sort_order');
      return data || [];
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['forum-posts', selectedCategory, search],
    queryFn: async () => {
      if (search.trim()) {
        const { data } = await supabase.rpc('search_forum', { search_query: search.trim() });
        return data || [];
      }
      let q = supabase.from('forum_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50);
      if (selectedCategory !== 'all') q = q.eq('category_id', selectedCategory);
      const { data } = await q;
      return data || [];
    },
  });

  const postIds = posts.map((p: any) => p.id);
  const userIds = [...new Set(posts.map((p: any) => p.user_id))];

  const { data: profiles = [] } = useQuery({
    queryKey: ['forum-profiles', userIds.join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', userIds);
      return data || [];
    },
  });

  const { data: commentCounts = [] } = useQuery({
    queryKey: ['forum-comment-counts', postIds.join(',')],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('forum_comments').select('post_id').in('post_id', postIds);
      return data || [];
    },
  });

  const { data: reactions = [] } = useQuery({
    queryKey: ['forum-reaction-counts', postIds.join(',')],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('forum_reactions').select('target_id, emoji').eq('target_type', 'post').in('target_id', postIds);
      return data || [];
    },
  });

  // Leaderboard
  const { data: leaderboard = [] } = useQuery({
    queryKey: ['forum-leaderboard'],
    queryFn: async () => {
      const { data: points } = await supabase.from('forum_contributor_points').select('user_id, points');
      const { data: rewards } = await supabase.from('forum_rewards').select('user_id, points');
      const map: Record<string, number> = {};
      (points || []).forEach((p: any) => { map[p.user_id] = (map[p.user_id] || 0) + p.points; });
      (rewards || []).forEach((r: any) => { map[r.user_id] = (map[r.user_id] || 0) + r.points; });
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const ids = sorted.map(s => s[0]);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', ids);
      return sorted.map(([uid, pts], idx) => {
        const prof = (profs || []).find((p: any) => p.id === uid);
        return { user_id: uid, points: pts, rank: idx + 1, full_name: prof?.full_name || 'User', avatar_url: prof?.avatar_url };
      });
    },
  });

  const profileMap = useMemo(() => {
    const m: Record<string, any> = {};
    profiles.forEach((p: any) => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const commentCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    commentCounts.forEach((c: any) => { m[c.post_id] = (m[c.post_id] || 0) + 1; });
    return m;
  }, [commentCounts]);

  const reactionMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    reactions.forEach((r: any) => {
      if (!m[r.target_id]) m[r.target_id] = {};
      m[r.target_id][r.emoji] = (m[r.target_id][r.emoji] || 0) + 1;
    });
    return m;
  }, [reactions]);

  const categoryMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c: any) => { m[c.id] = c.name; });
    return m;
  }, [categories]);

  const getRankBadge = (userId: string) => {
    const entry = leaderboard.find((l: any) => l.user_id === userId);
    if (!entry) return null;
    if (entry.rank === 1) return <span title="Gold Contributor" className="text-amber-500">🥇</span>;
    if (entry.rank === 2) return <span title="Silver Contributor" className="text-gray-400">🥈</span>;
    if (entry.rank === 3) return <span title="Bronze Contributor" className="text-orange-600">🥉</span>;
    return null;
  };

  return (
    <>
      <SEOHead title="Support Forum - Online Textile School" description="Ask questions, share knowledge, and connect with the textile community." />
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-heading font-bold">Support Forum</h1>
                  <p className="text-muted-foreground">Ask questions, share knowledge, earn points</p>
                </div>
                {user && (
                  <Button onClick={() => navigate('/forum/new')} className="gap-2">
                    <Plus className="h-4 w-4" /> New Post
                  </Button>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search forum posts, solutions, discussions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Tabs */}
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {categories.map((cat: any) => (
                    <TabsTrigger key={cat.id} value={cat.id}>{cat.name}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Posts */}
              <div className="space-y-3">
                {posts.length === 0 && (
                  <Card className="p-8 text-center text-muted-foreground">
                    No posts found. {user ? 'Be the first to ask a question!' : 'Login to start a discussion.'}
                  </Card>
                )}
                {posts.map((post: any) => {
                  const author = profileMap[post.user_id];
                  const cCount = commentCountMap[post.id] || 0;
                  const postReactions = reactionMap[post.id] || {};
                  const totalReactions = Object.values(postReactions).reduce((a: number, b: any) => a + (b as number), 0);

                  return (
                    <Card key={post.id} className="p-4 hover:shadow-md transition-shadow">
                      <Link to={`/forum/${post.id}`} className="block">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={author?.avatar_url} />
                            <AvatarFallback>{author?.full_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {post.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                              {post.is_closed && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                              <h3 className="font-semibold text-base truncate">{post.title}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span className="font-medium text-foreground flex items-center gap-1">
                                {author?.full_name || 'Unknown'} {getRankBadge(post.user_id)}
                              </span>
                              <span>·</span>
                              <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                              {post.category_id && categoryMap[post.category_id] && (
                                <>
                                  <span>·</span>
                                  <Badge variant="secondary" className="text-[10px]">{categoryMap[post.category_id]}</Badge>
                                </>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {cCount}</span>
                              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {totalReactions}</span>
                              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {post.view_count || 0}</span>
                              {Object.entries(postReactions).slice(0, 3).map(([emoji, count]) => (
                                <span key={emoji} className="text-xs">{emoji} {count as number}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Sidebar — Leaderboard */}
            <div className="w-full md:w-72 shrink-0 space-y-4">
              <Card className="p-4">
                <h3 className="font-heading font-semibold flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-amber-500" /> Top Contributors</h3>
                {leaderboard.length === 0 && <p className="text-xs text-muted-foreground">No contributors yet.</p>}
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((entry: any) => (
                    <div key={entry.user_id} className="flex items-center gap-2">
                      <span className="text-sm font-bold w-6 text-center">
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </span>
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={entry.avatar_url} />
                        <AvatarFallback className="text-[10px]">{entry.full_name?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{entry.full_name}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{entry.points} pts</Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-heading font-semibold text-sm mb-2">How Points Work</h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>📝 Create a post: <strong className="text-foreground">+10 pts</strong></p>
                  <p>💬 Reply/Comment: <strong className="text-foreground">+5 pts</strong></p>
                  <p>❤️ React: <strong className="text-foreground">+1 pt</strong></p>
                  <p>🎁 Admin Rewards: <strong className="text-foreground">Bonus</strong></p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ForumHome;

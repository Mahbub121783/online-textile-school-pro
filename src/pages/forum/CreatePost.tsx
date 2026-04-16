import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Send } from 'lucide-react';
import SEOHead from '@/components/SEOHead';

const CreatePost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('forum_categories').select('*').order('sort_order');
      return data || [];
    },
  });

  const filteredCategories = categories.filter((c: any) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const selectedCategory = categories.find((c: any) => c.id === selectedCategoryId);

  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('forum_posts').insert({
        user_id: user.id, title, content, category_id: selectedCategoryId,
      }).select().single();
      if (error) throw error;
      // Award points
      await supabase.from('forum_contributor_points').insert({
        user_id: user.id, action: 'post', reference_id: data.id, points: 10,
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success('Post created! +10 points');
      qc.invalidateQueries({ queryKey: ['forum-posts'] });
      qc.invalidateQueries({ queryKey: ['forum-leaderboard'] });
      navigate(`/forum/${data.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) {
    navigate('/auth/login');
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl py-8 space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/forum')} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Forum
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Create New Post</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input placeholder="What's your question or topic?" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div>
                <Label>Category</Label>
                <Input
                  placeholder="Search or select a category..."
                  value={selectedCategory ? selectedCategory.name : categorySearch}
                  onChange={(e) => {
                    setCategorySearch(e.target.value);
                    setSelectedCategoryId(null);
                  }}
                />
                {categorySearch && !selectedCategoryId && (
                  <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                    {filteredCategories.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground">No matching categories</p>
                    ) : (
                      filteredCategories.map((cat: any) => (
                        <button
                          key={cat.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => { setSelectedCategoryId(cat.id); setCategorySearch(''); }}
                        >
                          {cat.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {selectedCategory && (
                  <div className="mt-1">
                    <Badge variant="secondary" className="gap-1">
                      {selectedCategory.name}
                      <button onClick={() => setSelectedCategoryId(null)} className="ml-1 text-xs">×</button>
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <Label>Content</Label>
                <Textarea
                  placeholder="Describe your question or share your knowledge in detail..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  disabled={!title.trim() || !content.trim() || createPost.isPending}
                  onClick={() => createPost.mutate()}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" /> Publish Post
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default CreatePost;

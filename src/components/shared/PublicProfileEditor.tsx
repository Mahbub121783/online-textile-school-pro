import { useState, useEffect, KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ExternalLink, X, Globe, Linkedin, Github, Twitter, Sparkles, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  userId: string;
  mode?: 'self' | 'admin';
}

const BIO_LIMIT = 500;
const HEADLINE_LIMIT = 120;

const PublicProfileEditor = ({ userId, mode = 'self' }: Props) => {
  const qc = useQueryClient();
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [expertise, setExpertise] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [twitter, setTwitter] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['public-profile-editor', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, bio, headline, expertise, social_links, is_public_contributor, vote_count')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setHeadline(profile.headline || '');
    setBio(profile.bio || '');
    setExpertise(profile.expertise || []);
    setIsPublic(profile.is_public_contributor !== false);
    const links = (profile.social_links as any) || {};
    setWebsite(links.website || '');
    setLinkedin(links.linkedin || '');
    setGithub(links.github || '');
    setTwitter(links.twitter || '');
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const social_links = { website, linkedin, github, twitter };
      const { error } = await supabase
        .from('user_profiles')
        .update({
          headline: headline.slice(0, HEADLINE_LIMIT) || null,
          bio: bio.slice(0, BIO_LIMIT) || null,
          expertise: expertise.length ? expertise : null,
          social_links,
          is_public_contributor: isPublic,
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Profile saved');
      qc.invalidateQueries({ queryKey: ['public-profile-editor', userId] });
      qc.invalidateQueries({ queryKey: ['contributor-profile', userId] });
      qc.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  const resetVotes = useMutation({
    mutationFn: async () => {
      const { error: delErr } = await supabase.from('contributor_votes').delete().eq('contributor_id', userId);
      if (delErr) throw delErr;
      const { error: updErr } = await supabase.from('user_profiles').update({ vote_count: 0 }).eq('id', userId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success('Endorsements reset');
      qc.invalidateQueries({ queryKey: ['public-profile-editor', userId] });
      qc.invalidateQueries({ queryKey: ['contributor-profile', userId] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  const addTag = () => {
    const v = tagInput.trim();
    if (!v || expertise.includes(v) || expertise.length >= 12) {
      setTagInput('');
      return;
    }
    setExpertise([...expertise, v]);
    setTagInput('');
  };

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  if (isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2 font-heading">
            <Sparkles className="h-5 w-5 text-primary" />
            Public Profile
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === 'admin' ? `Editing as admin • ${profile?.full_name || 'User'}` : 'Shown on your /contributor page and on courses/eBooks you contribute to.'}
          </p>
        </div>
        <Link to={`/contributor/${userId}`} target="_blank" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
          Preview <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            placeholder="e.g. Textile Engineering Student at BUTEX"
            value={headline}
            maxLength={HEADLINE_LIMIT}
            onChange={(e) => setHeadline(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground text-right">{headline.length}/{HEADLINE_LIMIT}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={4}
            placeholder="Tell people about yourself, your expertise, and what you're passionate about…"
            value={bio}
            maxLength={BIO_LIMIT}
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground text-right">{bio.length}/{BIO_LIMIT}</p>
        </div>

        <div className="space-y-1.5">
          <Label>Areas of Expertise</Label>
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
            {expertise.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pl-2 pr-1">
                {tag}
                <button
                  type="button"
                  onClick={() => setExpertise(expertise.filter((t) => t !== tag))}
                  className="hover:bg-muted rounded p-0.5"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {expertise.length === 0 && <span className="text-xs text-muted-foreground">No tags yet</span>}
          </div>
          <Input
            placeholder="Type a skill and press Enter (max 12)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={onTagKey}
            onBlur={addTag}
            disabled={expertise.length >= 12}
          />
        </div>

        <div className="space-y-2">
          <Label>Social Links</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="https://your-site.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="https://linkedin.com/in/…" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
            </div>
            <div className="relative">
              <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="https://github.com/…" value={github} onChange={(e) => setGithub(e.target.value)} />
            </div>
            <div className="relative">
              <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="https://twitter.com/…" value={twitter} onChange={(e) => setTwitter(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div>
            <p className="text-sm font-medium">Show profile publicly</p>
            <p className="text-xs text-muted-foreground">
              {isPublic ? 'Your profile is visible to everyone.' : 'Your profile is hidden from the public.'}
            </p>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </div>

        {mode === 'admin' && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Endorsements: {profile?.vote_count ?? 0}</p>
              <p className="text-xs text-muted-foreground">Reset all endorsement votes for this user.</p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm('Delete all endorsements for this user?')) resetVotes.mutate();
              }}
              disabled={resetVotes.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save Profile'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PublicProfileEditor;

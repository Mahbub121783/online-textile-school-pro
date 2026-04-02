import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trophy, Medal, Award, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

const LeaderboardPage = () => {
  const { user } = useAuth();

  const { data: topStudents = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      // Get users with most completed enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('user_id, completed_at')
        .not('completed_at', 'is', null);

      if (!enrollments) return [];

      const userStats: Record<string, number> = {};
      enrollments.forEach((e: any) => {
        userStats[e.user_id] = (userStats[e.user_id] || 0) + 1;
      });

      const sortedUsers = Object.entries(userStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20);

      if (sortedUsers.length === 0) return [];

      const userIds = sortedUsers.map(([id]) => id);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      // Get certificates count
      const { data: certs } = await supabase
        .from('certificates')
        .select('user_id')
        .in('user_id', userIds);

      const certCount: Record<string, number> = {};
      (certs ?? []).forEach((c: any) => { certCount[c.user_id] = (certCount[c.user_id] || 0) + 1; });

      // Get badges count
      const { data: badges } = await supabase
        .from('user_badges')
        .select('user_id')
        .in('user_id', userIds);

      const badgeCount: Record<string, number> = {};
      (badges ?? []).forEach((b: any) => { badgeCount[b.user_id] = (badgeCount[b.user_id] || 0) + 1; });

      return sortedUsers.map(([userId, completedCourses], idx) => {
        const profile = (profiles ?? []).find((p: any) => p.id === userId);
        return {
          rank: idx + 1,
          userId,
          name: profile?.full_name || 'Student',
          avatar: profile?.avatar_url,
          completedCourses,
          certificates: certCount[userId] || 0,
          badges: badgeCount[userId] || 0,
          isCurrentUser: userId === user?.id,
        };
      });
    },
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-700" />;
    return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-heading font-bold">Leaderboard</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : topStudents.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No data yet. Complete courses to appear on the leaderboard!</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {topStudents.map((student: any) => (
            <Card key={student.userId} className={`transition-all ${student.isCurrentUser ? 'ring-2 ring-primary bg-primary/5' : ''} ${student.rank <= 3 ? 'border-yellow-500/30' : ''}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 flex items-center justify-center">{getRankIcon(student.rank)}</div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={student.avatar} />
                  <AvatarFallback>{student.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {student.name}
                    {student.isCurrentUser && <Badge className="ml-2 text-xs" variant="secondary">You</Badge>}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="text-center">
                    <p className="font-bold text-foreground">{student.completedCourses}</p>
                    <p className="text-xs">Courses</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-foreground">{student.certificates}</p>
                    <p className="text-xs">Certs</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-foreground">{student.badges}</p>
                    <p className="text-xs">Badges</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;

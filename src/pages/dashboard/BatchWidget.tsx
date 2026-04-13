import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

const BatchWidget = () => {
  const { user } = useAuth();

  const { data: myBatches = [] } = useQuery({
    queryKey: ['my-batches', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('batch_students' as any)
        .select('*, batches:batch_id(id, name, start_date, end_date, status)')
        .eq('user_id', user.id);
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  if (myBatches.length === 0) return null;

  const statusColors: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> My Batches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {myBatches.map((b: any) => (
          <div key={b.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
            <div>
              <p className="text-sm font-medium">{b.batches?.name}</p>
              <p className="text-xs text-muted-foreground">{b.batches?.start_date} — {b.batches?.end_date || 'Ongoing'}</p>
            </div>
            <Badge className={statusColors[b.batches?.status] || ''}>{b.batches?.status}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BatchWidget;

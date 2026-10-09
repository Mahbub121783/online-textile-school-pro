import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export const AMBASSADOR_SKILLS = [
  'Campus Lead', 'Graphics Design', 'Anchoring', 'Facebook Management', 'Video Editor',
  'IT Expert', 'Content Writing', 'Instructor', 'Email Writing', 'Digital Marketing',
];

interface Props {
  applicationId: string;
  currentSkills: string[];
}

const AmbassadorSkillsEditor = ({ applicationId, currentSkills }: Props) => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>(currentSkills || []);

  useEffect(() => setSelected(currentSkills || []), [currentSkills]);

  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...(currentSkills || [])].sort());

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ambassador_applications').update({ skills: selected }).eq('id', applicationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Skills & interests updated');
      queryClient.invalidateQueries({ queryKey: ['my-ambassador-app-full'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = (skill: string) => {
    setSelected((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Select the skills and interests you can contribute as an ambassador — this helps admin match you to the right opportunities.</p>
      <div className="flex flex-wrap gap-2">
        {AMBASSADOR_SKILLS.map((skill) => {
          const active = selected.includes(skill);
          return (
            <Badge
              key={skill}
              variant={active ? 'default' : 'outline'}
              className="cursor-pointer select-none px-3 py-1.5 text-sm"
              onClick={() => toggle(skill)}
            >
              {active && <Sparkles className="h-3 w-3 mr-1" />}
              {skill}
            </Badge>
          );
        })}
      </div>
      {dirty && (
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Save Skills
        </Button>
      )}
    </div>
  );
};

export default AmbassadorSkillsEditor;

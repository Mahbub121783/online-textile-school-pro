import { useState } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isPreviewOrEmbedded } from '@/lib/previewMode';

const FALLBACK = [
  { name: 'Md. Rakibul Hasan', institution: 'BUTEX', rating: 5, quote: 'Online Textile School helped me understand spinning technology deeply. The course quality is exceptional and the instructors are very responsive.' },
  { name: 'Fatema Khatun', institution: 'Ahsanullah University', rating: 5, quote: 'As a working professional, the flexibility of learning at my own pace was invaluable. I completed three courses and earned certificates that boosted my career.' },
  { name: 'Tanvir Ahmed', institution: 'DUET', rating: 4, quote: 'The eBooks are comprehensive and the course player is very user-friendly. I especially love the Q&A section where instructors actively help students.' },
];

const TestimonialsSection = () => {
  const [current, setCurrent] = useState(0);

  const { data: testimonials = FALLBACK } = useQuery({
    queryKey: ['homepage-testimonials'],
    queryFn: async () => {
      const { data } = await supabase
        .from('success_stories')
        .select('*')
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(6);
      if (!data || data.length === 0) return FALLBACK;
      return data.map((s: any) => ({
        name: s.name,
        institution: s.job_title || '',
        rating: 5,
        quote: s.story,
        photo: s.photo_url,
      }));
    },
    staleTime: 30 * 60 * 1000,
    retry: 0,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: !isPreviewOrEmbedded,
  });

  const t = testimonials[current];

  return (
    <section className="py-12 md:py-16 bg-secondary min-h-[360px]">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">What Our Students Say</h2>
          <p className="text-muted-foreground">Real experiences from textile learners across Bangladesh</p>
        </div>
        <div className="max-w-2xl mx-auto bg-card border rounded-xl p-8 relative">
          <Quote className="h-8 w-8 text-accent/30 absolute top-6 left-6" />
          <div className="text-center space-y-4 pt-4">
            <div className="flex justify-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < t.rating ? 'fill-warning text-warning' : 'text-muted'}`} />
              ))}
            </div>
            <p className="text-foreground leading-relaxed italic">"{t.quote}"</p>
            <div>
              <p className="font-heading font-semibold text-foreground">{t.name}</p>
              <p className="text-sm text-muted-foreground">{t.institution}</p>
            </div>
          </div>
          <div className="flex justify-center gap-2 mt-6">
            <button onClick={() => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length)} className="p-2 rounded-full hover:bg-secondary transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {testimonials.map((_: any, i: number) => (
              <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-accent w-6' : 'bg-muted-foreground/30'}`} />
            ))}
            <button onClick={() => setCurrent((c) => (c + 1) % testimonials.length)} className="p-2 rounded-full hover:bg-secondary transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;

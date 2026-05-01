## Goal

Jokhon kono notun workshop launch hobe (status `published`, `start_at` future e), seta automatically Hero Slider er **prothome** ekta sundor "NEW WORKSHOP" slide hishebe show korbe — admin er kichu korte hobe na. Sob workshop na, just **upcoming workshop er moddhe shob theke notun ta** (sort by `created_at desc`, take 1).

## Behavior

- Hero Slider load hobar shomoy `workshops` table query korbe: `status = 'published'` AND `start_at > now()`, order by `created_at desc`, limit 1.
- Pawa gele, oi workshop ta automatically slides array er **first slide** hishebe inject hobe (admin's hero_slides rows er age).
- Workshop slide e thakbe:
  - "🔴 NEW WORKSHOP" badge (animated pulse)
  - Workshop title (large heading)
  - Short description / tagline
  - Live countdown to `start_at` (existing CountdownDisplay component reuse)
  - Workshop thumbnail as background image (with gradient overlay)
  - Two CTAs: "Register Now" → `/workshops/{slug}` ar "Learn More" → same link
  - Instructor name + start date display
- Workshop launch/start hoye gele (start_at < now), automatically next workshop ashbe ba slide ta hide hoye jabe.
- Manual override nei — eta puro automatic.

## Technical approach

`HeroSlider.tsx` er moddhe ekta notun query add korbo:
```ts
const { data: latestWorkshop } = useQuery({
  queryKey: ['hero-latest-workshop'],
  queryFn: async () => {
    const { data } = await supabase
      .from('workshops')
      .select('id, title, slug, short_description, thumbnail_url, start_at, instructor:user_profiles!workshops_instructor_id_fkey(full_name)')
      .eq('status', 'published')
      .gt('start_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  staleTime: 60_000,
});
```

Tarpor existing `slides` memoization e workshop ke ekta slide-shaped object e convert kore array er prothome push korbo:
```ts
const slides = useMemo(() => {
  const base = dbSlides && dbSlides.length > 0 ? dbSlides : FALLBACK_SLIDES;
  if (!latestWorkshop) return base;
  const workshopSlide = {
    id: `ws-${latestWorkshop.id}`,
    title: latestWorkshop.title,
    subtitle: latestWorkshop.short_description || `Live workshop with ${latestWorkshop.instructor?.full_name}`,
    cta_text: 'Register Now',
    cta_link: `/workshops/${latestWorkshop.slug || latestWorkshop.id}`,
    secondary_cta_text: 'Learn More',
    secondary_cta_link: `/workshops/${latestWorkshop.slug || latestWorkshop.id}`,
    image_url: latestWorkshop.thumbnail_url || '',
    gradient_from: 'accent',
    gradient_to: 'primary-dark',
    gradient_direction: 'br',
    overlay_opacity: 15,
    text_alignment: 'left',
    countdown_target: latestWorkshop.start_at,
    is_workshop_slide: true, // for badge rendering
  };
  return [workshopSlide, ...base];
}, [dbSlides, latestWorkshop]);
```

`SlideContent` component e `slide.is_workshop_slide` true hole top e ekta animated "🔴 NEW WORKSHOP" badge render korbo (pulse animation diye attention grab korbe).

## Files to change

- `src/components/features/home/HeroSlider.tsx` — query add, slide injection, badge rendering

Approve to implement.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Live-updates a campus's public portfolio page (notices, gallery,
 * instructor/student roster, profile edits) via the same SSE/LISTEN-NOTIFY
 * push system useAuth.tsx already uses for per-user updates -- these pages
 * are anonymous/public though, so this subscribes by campus_id instead of a
 * JWT-identified user_id (GET /realtime/campus/:campusId, no auth).
 */
export function useCampusRealtime(campusId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!campusId) return;
    const apiBase = import.meta.env.VITE_SUPABASE_URL || 'https://api.onlinetextileschool.com';
    const es = new EventSource(`${apiBase}/realtime/campus/${campusId}`);

    es.addEventListener('notices_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['campus-notices', campusId] });
    });
    es.addEventListener('gallery_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['campus-gallery', campusId] });
    });
    es.addEventListener('people_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['campus-people', campusId] });
      queryClient.invalidateQueries({ queryKey: ['campus-registered-count', campusId] });
    });
    es.addEventListener('profile_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['campus-onboard-detail', campusId] });
      queryClient.invalidateQueries({ queryKey: ['campus-portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['my-owned-campus-full'] });
    });

    return () => es.close();
  }, [campusId, queryClient]);
}

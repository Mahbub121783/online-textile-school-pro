// Global emergency mode flag. When true, all non-essential queries
// (analytics, counts, polling, realtime) MUST be skipped to let the
// Supabase Disk IO budget recover.
//
// To toggle: set localStorage 'ots-maintenance' to '1' (force on) or '0' (force off).
// Default behavior: ON in Lovable preview/embed, OFF on production domain.

import { isPreviewOrEmbedded } from './previewMode';

const LS_KEY = 'ots-maintenance';

const readOverride = (): boolean | null => {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
    return null;
  } catch { return null; }
};

export const isMaintenanceMode = (() => {
  const override = readOverride();
  if (override !== null) return override;
  // Default: ON inside preview iframe to protect DB while editing
  return isPreviewOrEmbedded;
})();

// Helper: true when expensive queries should be skipped completely.
export const shouldSkipHeavyQueries = isMaintenanceMode;

// Helper: true when realtime channels should NOT be opened.
export const shouldSkipRealtime = isMaintenanceMode;

// Single source of truth for "is maintenance mode actually in effect right
// now" -- combines the manual on/off flag with an optional auto-off end time
// and/or an optional scheduled future start, so a duration-limited or
// scheduled maintenance window doesn't need a cron job to flip anything in
// the DB: it's just a pure function of the current time.
// Mirrored in backend/src/realtime.js's computeSystemStats() (kept in sync
// by hand -- different runtime, can't share this file directly).
export interface MaintenanceSettings {
  maintenance_mode?: string;
  maintenance_scheduled_start?: string;
  maintenance_scheduled_end?: string;
}

export function isMaintenanceActive(settings: MaintenanceSettings, now: Date = new Date()): boolean {
  const end = settings.maintenance_scheduled_end ? new Date(settings.maintenance_scheduled_end) : null;
  const start = settings.maintenance_scheduled_start ? new Date(settings.maintenance_scheduled_start) : null;

  // Manually turned on -- active unless its own auto-off timer has passed.
  if (settings.maintenance_mode === 'true') {
    return !(end && now >= end);
  }
  // Not manually on -- active only inside a scheduled future window.
  if (start && now >= start) {
    return !(end && now >= end);
  }
  return false;
}

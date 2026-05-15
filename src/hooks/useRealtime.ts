/**
 * EMERGENCY MODE — Phase 1 (Free Tier 200-channel cap):
 * Layout-level realtime channels are removed. Notifications now use
 * 60s polling inside `useNotifications` (mounted only at <NotificationBell />),
 * so each logged-in user holds at most ONE polling query and ZERO
 * persistent realtime channels by default.
 *
 * The only persistent realtime channel allowed app-wide is the chat
 * channel inside <ChatWidget />, which mounts only while the widget is open.
 *
 * These exports are kept as no-ops to preserve all existing call sites
 * (DashboardLayout, InstructorLayout, AdminLayout) without removing them.
 */
export function useAdminRealtime() { /* no-op: polling handles freshness */ }
export function useInstructorRealtime() { /* no-op: polling handles freshness */ }
export function useStudentRealtime() { /* no-op: polling handles freshness */ }

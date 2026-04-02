

## Plan: Upgrade Super Admin to Full-Control Owner Dashboard

### Current State

Right now, `admin` and `super_admin` have **identical access**. The `AdminLayout` checks `roles.includes('admin') || roles.includes('super_admin')` but nothing differentiates them. There is no super_admin-exclusive section, no system health view, no ability to manage other admins, and no global override controls.

### What's Missing for a True Super Admin (System Owner)

| Gap | Impact |
|-----|--------|
| No distinction between admin vs super_admin permissions | Any admin can do everything a super_admin can |
| No system health / server status overview | Owner has no visibility into edge function health, DB size, storage usage |
| No admin management (can't see/revoke other admins) | No control over who has admin access |
| Dashboard lacks revenue charts, growth trends | Owner can't see business trajectory at a glance |
| No global system controls (maintenance mode toggle, cache clear) from dashboard | Must navigate deep into settings |
| No bulk data export (users, orders, revenue CSV) | Owner can't extract business data |
| Sidebar doesn't show super_admin badge or distinguish the role | No visual identity |
| Settings page is minimal (7 fields) | Missing many site-wide controls |
| No "impersonate user" or "login as" capability | Can't debug user issues |
| Wallets page works but no summary analytics | No financial overview |

### Implementation Plan

**Step 1: Enhanced Super Admin Dashboard** (replace AdminDashboard for super_admin)
- Revenue trend line chart (last 30 days) using recharts
- User growth chart (signups per day)
- System health cards: total DB records, active edge functions, storage bucket size
- Quick-action grid: Maintenance toggle, Export Users CSV, Export Orders CSV, Manage Admins
- Pending items summary: pending orders, pending instructor apps, pending withdrawals with direct links
- Recent signups feed alongside existing enrollments/orders/activity

**Step 2: Admin Management Page** (super_admin only)
- New page: list all users with admin/super_admin roles
- Grant/revoke admin role (super_admin cannot be removed by regular admin)
- View last login time, activity count per admin
- Guard: only super_admin can access this page

**Step 3: System Controls Panel** (super_admin only)
- Maintenance mode toggle (instant, from dashboard)
- Clear query caches button
- Export buttons: Users CSV, Orders CSV, Revenue Report CSV
- Edge function status list (shows deployed functions)
- Database table row counts

**Step 4: Sidebar & Layout Upgrades**
- Show role badge in sidebar header (Super Admin vs Admin)
- Add "System" group in sidebar for super_admin only: Admin Management, System Controls
- Add "Wallets" to existing sidebar items
- Visual distinction: gold/amber accent for super_admin badge

**Step 5: Role-Based Access Guards**
- Create `isSuperAdmin` helper in useAuth
- Wrap super_admin-only routes with a guard component
- Regular admins see a "Super Admin Only" message if they navigate to restricted pages

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/admin/AdminManagement.tsx` | Admin user management (super_admin only) |
| `src/pages/admin/SystemControls.tsx` | System health, exports, maintenance controls |

### Files to Edit

| File | Changes |
|------|---------|
| `src/pages/admin/AdminDashboard.tsx` | Add revenue/user charts, system health cards, quick actions |
| `src/components/layout/AdminSidebar.tsx` | Add role badge, System group for super_admin, Wallets link |
| `src/hooks/useAuth.tsx` | Add `isSuperAdmin` boolean to context |
| `src/App.tsx` | Add 2 new admin routes |
| `src/pages/admin/AdminLayout.tsx` | Pass role info to outlet context for child route guards |

### No Migration Needed
All data already exists in current tables. No new DB tables required.

### Technical Notes
- Charts use `recharts` (already available via shadcn chart)
- CSV export uses browser-native `Blob` + download anchor pattern
- System health data comes from existing Supabase queries (count queries on major tables)
- Role guard is client-side only (RLS already blocks unauthorized DB access server-side)
- Total: 2 new files, 5 edited files


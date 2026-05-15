# Disk IO Budget Exhausted — Recovery Plan (No Upgrade)

## Problem
Supabase Nano instance er **Disk IO Budget 100% used**. Ekhon baseline 43 Mbps e cholche, tai query gulo timeout (544) hocche. Budget refill hote **24 ghonta** lage. Quiz system add korar por se database e onek beshi read/write hocche, jeta budget druto khachey.

## Strategy
Duita layer e kaj korte hobe:
1. **Immediate recovery** — database ke breathe korte dewa, jate budget refill hoy
2. **Long-term reduction** — query volume kombano, jate abar same somossa na hoy

---

## Phase 1: Immediate Recovery (0–24 ghonta)

### 1.1 App ke "Maintenance Mode" e rakha
- Ekta global flag (`VITE_MAINTENANCE_MODE`) toiri kora
- On thaakle homepage e ekta friendly notice dekhabo: "We're optimizing our systems, back in a few hours"
- Sob non-essential query (analytics, stats, counts, realtime, polling) **complete bondho**
- Sudhu login + critical course access kaj korbe
- 6–12 ghonta por off kore dewa hobe

### 1.2 Realtime + Polling fully disable
- `useRealtime`, `useNotifications`, `useAdminRealtime` — sob channel temporarily off
- Sob `refetchInterval` remove
- Edge function gulo j cron e cholche (pg_cron jobs) — temporarily pause kora

### 1.3 Edge Functions audit
- Background jobs (email reminders, notifications, scheduled tasks) check kore dekha kon gulo IO khacche
- Non-critical ones temporarily disable

---

## Phase 2: Quiz System Optimization (root cause)

Quiz system e jegulo IO khacche:

### 2.1 Database Indexes add kora
Quiz tables e proper index nai hoyto. Add korbo:
- `qb_questions(subject_id, difficulty)` composite index
- `qb_questions(is_active, created_at)` 
- `quiz_attempts(user_id, quiz_id, created_at)`
- `quiz_attempts(quiz_id, status)`
- Index thakle full-table scan hobe na, IO 10x kome jabe

### 2.2 Materialized counts table
Count query (kotogulo question, kotogulo attempt) bar bar chalano bondho:
- Notun table: `qb_stats_cache` (subject_id, difficulty, question_count, updated_at)
- Trigger diye auto-update korbo jokhon question add/delete hoy
- Frontend ei cache theke porbe — full scan ar dorkar nai

### 2.3 Aggregate functions DB side e
Client side e count korar bodole, ekta SQL function banabo:
- `get_practice_overview()` — ek call e shob subject/difficulty count return korbe
- Multiple round-trip ekta call e nemey ashbe

---

## Phase 3: Application-wide Hardening

### 3.1 Query budget enforcement
- Ekta wrapper `useBudgetedQuery` toiri kora — jeita check korbe last 1 min e koto query gelo
- Threshold cross korle automatic skip/cache fallback

### 3.2 Aggressive caching
- React Query staleTime: critical data 10min, semi-critical 1hr, static (settings, currencies) 24hr
- localStorage persistence sob shared data e (already partially done)

### 3.3 Pagination limits
- Sob list query e `.limit()` mandatory (max 50)
- Admin tables e infinite scroll, eki shathe 1000 row na

### 3.4 Realtime — shudhu jekhane needed
- Notifications: yes
- Live class participants: yes  
- Onno shob (course updates, quiz updates, etc.): polling on-demand, realtime na

---

## Phase 4: Monitoring

- Supabase dashboard e **Reports → Database** check korar habit
- Disk IO graph e spike dekhle agei kaj kora
- Slow query log enable kora — kon query beshi time nicche

---

## Technical Files Affected
- **New**: `src/lib/maintenanceMode.ts`, `src/components/MaintenanceBanner.tsx`, `src/hooks/useBudgetedQuery.ts`
- **Migration**: indexes on `qb_questions`, `quiz_attempts`; new `qb_stats_cache` table + trigger; `get_practice_overview()` SQL function
- **Modify**: `useRealtime.ts`, `useNotifications.ts`, `PracticeHome.tsx`, `PracticeSubject.tsx`, `QuizDashboard.tsx`, `AdminQuestionBank.tsx`
- **Pause**: pg_cron jobs (notification triggers, email scheduling)

---

## Expected Result
- **24 ghontar moddhe**: Disk IO budget refill, app abar normal
- **Long-term**: Quiz system ~70% kom IO khabe, similar crash ar hobe na
- **No upgrade lage na** — Nano instance e bhalo cholbe

## Trade-offs
- Maintenance mode chalakale users full feature pabe na 6-12 ghonta
- Realtime kichu jaygay polling diye replace hobe — kichu UI 30s-1min late update hote pare
- Admin analytics dashboard kichu data on-demand load hobe (button click korte hobe)

Phase 1 immediately apply korbo (recovery), tarpor Phase 2-3 step-by-step. Approve korle suru kori.

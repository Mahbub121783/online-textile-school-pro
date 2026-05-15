## আসল সমস্যাটা কী (deep diagnosis)

আমি actively verify করেছি — শুধু frontend bug না:

1. **Supabase DB নিজেই down-state-এ আছে।** আমার tool থেকে চালানো trivial query `select now()` পর্যন্ত fail করছে:
   `544 — Connection terminated due to connection timeout`.
   এটা হয় তখনই যখন instance compute/IO saturated, app code এ কিছুই বদলালে এটা ঠিক হবে না।

2. **আপনার screenshot সেটাই confirm করছে:**
   - "Your project is currently exhausting multiple resources"
   - "Your **Disk IO Budget has been used up** … running at the **baseline** performance"
   - Current compute = **Nano** (free tier), baseline IO = **43 Mbps**, daily burst limit = **30 mins** — সেটা শেষ.
   এই অবস্থায় Postgres connections কেউ পায়, কেউ পায় না — তাই login ও data load random fail করছে।

3. **App-side amplifiers (যেগুলো এই saturation-কে আরো বাজে করছে):**
   - **Homepage burst:** Hero, FeaturedCourses, FeaturedWorkshops + counts, Stats (4 parallel COUNT queries on `user_roles` / `courses` / `user_profiles`), Ebooks, Events, Instructors, Sponsors, LearningPaths, Testimonials — public visit-এই 12+ queries fire হয়। `enabled: !isPreviewOrEmbedded` শুধু কয়েকটায় আছে, **StatsSection / FeaturedCourses / EbookShowcase / etc.** এ নেই → preview-তেও fire করছে.
   - **NotificationBell duplicated:** Header-এ desktop+mobile **দুই জায়গায়** mount করা — same user-এ `useNotifications` দু'বার চলছে, তাই দুটি realtime channel + দুটি 2-min polling + দুটি initial query fire হচ্ছে. Dashboard/Admin/Instructor layout-এ আবার একটা — তিন নম্বর বার.
   - **Broad realtime invalidation:** `useAdminRealtime` schema-wide subscribe করছে `orders`, `enrollments`, `wallet_transactions`, `wallets`, `courses`, `user_profiles`, `refund_requests`, `invoices`, `notifications`, `quizzes`, `quiz_questions`, `quiz_attempts`, `forum_posts`, `forum_comments`, `forum_reactions` — যেকোনো একটা change হলে multiple `invalidateQueries` → cascade refetch-storm.
   - **Stats COUNT queries** unbounded table scans — saturated DB-তে এগুলোই সবচেয়ে দামি.

**Bottom line:** Code-only patch এই issue পুরোপুরি সারাবে না — **Nano instance scaling-up না করলে DB stable হবে না**। কিন্তু code-side amplifiers কমালে recovery দ্রুত হবে এবং future-এ আবার এই অবস্থা হবে না.

---

## Fix Plan — দুই ধাপে

### Step 1 — Infrastructure (এটা আপনাকেই করতে হবে, code না)

Supabase Dashboard → Project → **Settings → Add-ons → Compute size** → **Nano থেকে Micro বা Small-এ upgrade**.

- Nano = shared CPU, ≤0.5 GB RAM, 43 Mbps baseline IO, 30-min daily burst.
- Micro (~$10/mo) = 1 GB RAM, much higher IO budget.
- Small (~$15/mo) = 2 GB RAM, recommended যেহেতু আপনার project-এ 30+ tables, realtime, edge functions, file metadata সব আছে.

Upgrade করার ~5 min পর instance restart হবে এবং login + data load স্বাভাবিক হবে.

### Step 2 — App-side hardening (আমি code-এ করব, approve করলে)

1. **Header NotificationBell deduplicate** — desktop+mobile একই component-এ একবারই mount, layout-এ আলাদা bell সরিয়ে header-এর-টাই use হবে → 1 user-এ 1 channel + 1 polling, 3টা না.

2. **`useNotifications` polling soft-mode** — `refetchInterval` 2 min → 5 min, realtime থাকলে polling skip; saturated DB-তে retry exponential.

3. **Realtime narrowing** —
   - `useAdminRealtime` শুধু সেই tables subscribe করবে যেগুলো actually currently visible page-এ লাগে (lazy mount per route inside admin), অথবা debounced single invalidation bus.
   - `useStudentRealtime` থেকে `enrollments`, `lesson_progress`, `discussions` সরিয়ে শুধু `notifications` রাখব (rest already polled when needed).

4. **Homepage query trimming** —
   - `StatsSection`-এর 4টা COUNT query একটা cached `home_stats` materialized view/RPC দিয়ে replace, 1 hour stale, public visit-এ 1 query.
   - `FeaturedCourses`, `EbookShowcase`, `LearningPathsPreview`, `InstructorSpotlight`, `Testimonials`, `Sponsors`, `UpcomingEvents`, `ClassVideosShowcase` সবগুলোতে `enabled: !isPreviewOrEmbedded` add করব যাতে preview iframe DB-তে hit না করে.
   - `FeaturedCourses` query শুধু `is_published=true LIMIT 8`, কিন্তু select payload trim (avg_rating/enrollment_count যথেষ্ট, instructor join optional).

5. **Global request budget** — একটা small `supabase` wrapper add করব যা parallel in-flight `from()` requests > 6 হলে queue করে; saturated period-এ stampede রোধ করে.

6. **Auth resilience** — `useAuth.fetchUserData` saturated state-এ profile/roles fail হলে cached stale value return করবে আর background-এ retry-with-backoff করবে; login UI কখনো hang করবে না.

---

## ⚠ Honest expectation

Step 2 alone DB recovery এনে দেবে না — Disk IO budget reset না হওয়া পর্যন্ত (next day) বা compute upgrade না করা পর্যন্ত performance baseline-এই থাকবে। Step 1 (compute upgrade) **mandatory**, Step 2 future-proofing।

আমাকে বলুন:
- আপনি কি এখনই Supabase compute upgrade করতে পারবেন? (Yes হলে আমি Step 2 implement করা শুরু করব।)
- নাকি এখনি Step 2 (code hardening) approve করব যাতে IO budget reset-এর পরে app আর এত resource burn না করে?
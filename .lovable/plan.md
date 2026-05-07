# Fix: Workshop registration stays open after end

## Bug confirmed

In `src/pages/static/WorkshopDetail.tsx` the "Register Now" card is rendered whenever:

```ts
workshop.status !== 'completed' && workshop.status !== 'cancelled' && !isFull
```

It does **not** check:

- `workshop.registration_deadline` (column exists on `workshops`, type `timestamptz`)
- `endDt` (computed end time / `end_at`)

Result: if the admin forgets to flip `status` to `completed`, or the workshop date has already passed, users can still register and even auto-register via `?register=true`. The mutation also doesn't validate window server-side via the client check.

The `registerMutation` (lines 129-156) and the auto-register effect (lines 158-182) have the same gap.

## Changes

### 1. `src/pages/static/WorkshopDetail.tsx`

- Compute additional flags after `startDt` / `endDt`:
  - `deadlineDt = workshop.registration_deadline ? new Date(...) : null`
  - `deadlinePassed = deadlineDt && now > deadlineDt`
  - `workshopEnded = now > endDt || status === 'completed'`
  - `registrationClosed = deadlinePassed || workshopEnded || status === 'cancelled' || isFull`
  - `closedReason` string explaining which condition closed it.
- Replace the `Register Now` card condition: render it only when `!isRegistered && !registrationClosed`. When `registrationClosed && !isRegistered`, render a small read-only card with an `AlertCircle` icon and the `closedReason`.
- Disable the `Register for Free` button if `registrationClosed`.
- In `handleRegisterClick` and `registerMutation.mutationFn`, guard with `if (registrationClosed) { toast.error(closedReason); return; }` so even old cached UIs cannot submit.
- In the auto-register `useEffect`, add `!registrationClosed` to the condition list so `?register=true` does nothing for ended workshops; show toast `"Registration is closed"` instead and clean URL.

### 2. `src/pages/static/WorkshopsPage.tsx` (listing)

- On workshop cards, when `registration_deadline` passed or `end_at`/`end_date+end_time` is in the past, show a "Registration closed" badge instead of "Register" CTA. Also hide the card from the "Upcoming" filter.

### 3. Server-side guard (defense in depth)

- Add a Postgres `BEFORE INSERT` trigger on `workshop_registrations` that raises if:
  - `workshop.status IN ('completed','cancelled')`, OR
  - `workshop.registration_deadline IS NOT NULL AND now() > workshop.registration_deadline`, OR
  - `COALESCE(workshop.end_at, (workshop.end_date + COALESCE(workshop.end_time,'23:59'::time))::timestamptz) < now()`, OR
  - `workshop.max_participants IS NOT NULL AND current_count >= max_participants`.
- This protects against direct API calls bypassing the UI.

```sql
CREATE OR REPLACE FUNCTION public.enforce_workshop_registration_window()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE w public.workshops; cnt int; ends_at timestamptz;
BEGIN
  SELECT * INTO w FROM public.workshops WHERE id = NEW.workshop_id;
  IF w.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Registration closed: workshop is %', w.status USING ERRCODE='check_violation';
  END IF;
  IF w.registration_deadline IS NOT NULL AND now() > w.registration_deadline THEN
    RAISE EXCEPTION 'Registration deadline has passed' USING ERRCODE='check_violation';
  END IF;
  ends_at := COALESCE(w.end_at,
                      (w.end_date + COALESCE(w.end_time,'23:59'::time))::timestamp AT TIME ZONE 'UTC');
  IF ends_at IS NOT NULL AND now() > ends_at THEN
    RAISE EXCEPTION 'Workshop has already ended' USING ERRCODE='check_violation';
  END IF;
  IF w.max_participants IS NOT NULL THEN
    SELECT count(*) INTO cnt FROM public.workshop_registrations
      WHERE workshop_id = NEW.workshop_id AND status='registered';
    IF cnt >= w.max_participants THEN
      RAISE EXCEPTION 'Workshop is full' USING ERRCODE='check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_workshop_registration_window ON public.workshop_registrations;
CREATE TRIGGER trg_enforce_workshop_registration_window
BEFORE INSERT ON public.workshop_registrations
FOR EACH ROW EXECUTE FUNCTION public.enforce_workshop_registration_window();
```

### 4. Map error nicely in mutation

- In `registerMutation.onError`, when message contains `"deadline"`, `"ended"`, `"full"`, or `"closed"`, show a friendly toast and set local `registered=false`.

## Result

- Past / cancelled / deadline-expired workshops show **"Registration closed"** with the exact reason instead of an active Register button.
- `?register=true` from login redirect no longer silently registers a user into an ended workshop.
- DB trigger blocks any direct API insert outside the window — protects scripted abuse and stale clients.
- Workshops listing page reflects the same closed state.

if this continue block the registratin when workshop date is closed , 
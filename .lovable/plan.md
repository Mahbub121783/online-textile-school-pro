

## Plan: Fix Roll ID Not Being Generated

### Root Cause

The `handle_new_user()` database trigger function generates a `new_roll_id` variable but **never includes it in the INSERT statement**. The current function:

```sql
new_roll_id := 'OTS-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');

INSERT INTO public.user_profiles (id, full_name, avatar_url, referral_code)
VALUES (...);  -- roll_id is MISSING here
```

Both existing users have `roll_id = NULL`.

### Fix (1 migration)

**Migration**: Fix the `handle_new_user()` function AND backfill existing users.

1. Replace the function to include `roll_id` in the INSERT:
```sql
INSERT INTO public.user_profiles (id, full_name, avatar_url, referral_code, roll_id)
VALUES (NEW.id, ..., new_roll_id);
```

2. Backfill all existing users who have `roll_id IS NULL`:
```sql
UPDATE public.user_profiles
SET roll_id = 'OTS-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0')
WHERE roll_id IS NULL;
```

### File Summary

| File | Action |
|------|--------|
| Migration | Fix `handle_new_user()` function + backfill existing NULLs |

No frontend changes needed — the ID card already reads `roll_id` from `user_profiles`. Once the data is populated, it will display correctly.


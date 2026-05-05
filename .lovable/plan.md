# Advanced Custom Fields Builder for Registration Purposes

## Problem
Currently `Custom Fields (JSON)` requires admins to hand-write JSON. There is no UI to add/edit/reorder fields, no field-type picker, no options editor, and limited types (text/select/number/date only).

## Goal
Replace the raw JSON textarea in `AdminRegistrations.tsx` → `FormSettingsTab` → New/Edit Purpose dialog with a fully visual, dynamic, reorderable Custom Fields builder. Also extend the public form renderer to support all new field types.

---

## 1. New Component: `CustomFieldsBuilder`

**File:** `src/components/admin/CustomFieldsBuilder.tsx`

Props:
- `value: CustomField[]`
- `onChange: (fields: CustomField[]) => void`

`CustomField` shape (extended):
```ts
{
  key: string;            // auto-slug from label, editable
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'url'
       | 'date' | 'time' | 'datetime'
       | 'select' | 'multiselect' | 'radio' | 'checkbox'
       | 'file' | 'rating';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];           // for select/multiselect/radio
  min?: number; max?: number;   // for number/rating
  defaultValue?: string;
  width?: 'full' | 'half';      // grid span
}
```

Features:
- "Add Field" button appends a blank field card.
- Each field rendered as a collapsible card showing: label, type badge, required star.
- Inline edit: Label, Key (auto-generated from label, editable), Type (Select dropdown), Required (Switch), Placeholder, Help Text, Width (half/full).
- When type ∈ {select, multiselect, radio}: show Options sub-editor (add/remove chips, drag to reorder).
- When type = number/rating: show Min/Max inputs.
- Reorder via up/down buttons (no extra deps) — array move helpers.
- Duplicate field button.
- Delete with confirm.
- Empty state: friendly "No custom fields yet — add your first" CTA.
- Live JSON preview (collapsible `<details>`) for power users + "Import JSON" / "Export JSON" buttons (keeps backward compatibility).
- Validation: keys must be unique + match `^[a-z0-9_]+$`; show inline error.

## 2. Wire into Admin Dialog

**File:** `src/pages/admin/AdminRegistrations.tsx`

- Change `form.custom_fields` state from `string` (JSON) to `CustomField[]`.
- Replace lines 150–155 (Textarea + JSON helper) with `<CustomFieldsBuilder value={form.custom_fields} onChange={...} />`.
- Update `openNew`, `openEdit`, `save` to use the array directly (drop `JSON.parse`/`stringify` round-trip).
- Make dialog wider (`max-w-3xl`) since the builder needs more room.

## 3. Extend Public Renderer

**File:** `src/pages/registration/PublicRegistration.tsx` (lines 361–388)

Add rendering branches for new types:
- `textarea` → `<Textarea>`
- `email` / `phone` / `url` → `<Input type=...>`
- `time` / `datetime` → `<Input type="time" | "datetime-local">`
- `multiselect` → multi-checkbox group, store as `string[]`
- `radio` → RadioGroup
- `checkbox` (single) → Switch / Checkbox boolean
- `rating` → 1–5 star buttons
- `file` → reuse photo upload pattern (Cloudinary via existing `useFileUpload`); store URL string
- Apply `width: 'half'` via grid `md:col-span-1` vs `md:col-span-2`
- Show `helpText` under input; use `placeholder`
- Required validation respected via `required` prop / manual check before submit for non-native types

## 4. Backward Compatibility

- Existing rows in `registration_purposes.custom_fields` keep working (old shape is a subset).
- Builder seeds missing optional props with sensible defaults when loading legacy data.
- No DB migration needed — column is already `jsonb`.

## 5. Files Touched
- **New:** `src/components/admin/CustomFieldsBuilder.tsx`
- **Edit:** `src/pages/admin/AdminRegistrations.tsx` (dialog body + form state)
- **Edit:** `src/pages/registration/PublicRegistration.tsx` (custom-field rendering block)

## Out of Scope
- Drag-and-drop library (using up/down buttons to keep bundle small).
- Conditional field visibility (can be a future iteration).
- Per-field analytics.

Approve korle implement kore debo.
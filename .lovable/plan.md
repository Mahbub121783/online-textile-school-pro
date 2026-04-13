

# Advanced Placeholders, Default Templates, and Compose Email Search

## Overview
Three major improvements to the email system: (1) comprehensive placeholders sourced from all user/course/order/ebook data, (2) pre-built professional HTML templates for every template type, (3) email recipient search from database in Compose Email.

---

## 1. Comprehensive Placeholder System

### Current State
Each template has only 3-5 basic placeholders. The compose page has only 4 placeholders. Missing: user profile fields, ebook data, registration data, invoice numbers, student ID, etc.

### New Universal Placeholders (available to ALL templates)

**User Profile (A-Z):**
`{{user_name}}`, `{{user_email}}`, `{{user_phone}}`, `{{user_avatar_url}}`, `{{user_batch}}`, `{{user_blood_group}}`, `{{user_company_name}}`, `{{user_country}}`, `{{user_current_job}}`, `{{user_date_of_birth}}`, `{{user_district}}`, `{{user_division}}`, `{{user_occupation}}`, `{{user_professional_role}}`, `{{user_referral_code}}`, `{{user_roll_id}}`, `{{user_university}}`, `{{user_username}}`, `{{user_created_at}}`

**Course:**
`{{course_name}}`, `{{course_id}}`, `{{course_price}}`, `{{course_description}}`, `{{course_url}}`, `{{course_instructor}}`

**Order/Invoice:**
`{{order_id}}`, `{{order_total}}`, `{{order_items}}`, `{{order_date}}`, `{{invoice_number}}` (auto-generated: `INV-YYYYMMDD-XXXXX`), `{{payment_method}}`, `{{payment_status}}`

**Ebook:**
`{{ebook_title}}`, `{{ebook_id}}`, `{{ebook_author}}`, `{{ebook_price}}`, `{{ebook_download_url}}`

**Certificate:**
`{{certificate_number}}`, `{{certificate_download_url}}`, `{{certificate_date}}`

**Registration:**
`{{registration_type}}`, `{{registration_date}}`, `{{registration_status}}`

**System:**
`{{site_name}}`, `{{site_url}}`, `{{support_email}}`, `{{current_date}}`, `{{current_year}}`, `{{login_url}}`

### Implementation
- Create a `GLOBAL_PLACEHOLDERS` constant grouped by category (User, Course, Order, Ebook, Certificate, Registration, System)
- Each template type gets ALL global placeholders plus its context-specific ones
- In the template editor, show placeholders in collapsible category groups (not a flat list)
- Clicking a placeholder inserts it at cursor position in the body textarea
- In the compose page sidebar, show the same grouped placeholder system
- The Edge Function's placeholder replacement already handles `{{key}}` pattern -- just need to pass more data from the trigger points

### Files
- `EmailTemplatesTab.tsx` -- replace per-template placeholder arrays with global grouped system
- `AdminEmailCompose.tsx` -- update sidebar placeholders with full grouped list
- `send-smtp-email/index.ts` -- no change needed (already replaces any `{{key}}` from placeholders object)

---

## 2. Pre-Built Professional Default Templates

### New Template Types to Add
- `ebook_purchase` -- Ebook Purchase Confirmation
- `ebook_download` -- Ebook Download Link
- `user_registration` -- New User Registration (self-registered)
- `course_completion` -- Course Completion Congratulations
- `assignment_submitted` -- Assignment Submission Confirmation
- `quiz_completed` -- Quiz Completion Results
- `wallet_credit` -- Wallet Credit Notification
- `wallet_debit` -- Wallet Debit Notification
- `id_card_issued` -- Student ID Card Issued

### Default Template Bodies
Each of the 25 total template types will get a professionally designed default HTML body pre-filled when admin clicks "Edit" (if no custom template exists yet). The defaults use placeholder variables and clean HTML structure matching the branded wrapper.

### Files
- `EmailTemplatesTab.tsx` -- expand `TEMPLATE_TYPES` array with new types + add `defaultBody` field with pre-built HTML for each

---

## 3. Compose Email: Search Recipients from Database

### Current Problem
The compose page only allows manual email entry. Bulk send to "All Students" and "Course Students" shows an error because it cannot fetch emails.

### Solution
- Add a **user search** field that queries `user_profiles` joined with auth metadata
- Since we cannot access `auth.users` directly from client, we will store/lookup emails via a new approach: query `user_profiles` and show results with names, then the admin selects users
- Add a searchable dropdown/combobox that searches `user_profiles` by `full_name`, `username`, `phone`
- Selected users appear as chips/tags showing name
- For "All Students" and "Course Students" modes: fetch enrolled user IDs from `enrollments` table, then look up their profiles, and require email input per user (or use a server-side approach via the Edge Function)
- Add a **"Search & Select"** mode alongside manual input

### Implementation
- Add a search input with debounced query to `user_profiles`
- Show results in a dropdown list with name, phone, roll_id
- Selected users added to a recipient list
- Admin can still type emails manually
- For bulk modes: fetch user profiles and display them in a selectable list, admin provides/confirms emails

### Files
- `AdminEmailCompose.tsx` -- add search combobox, user selection chips, fix bulk send

---

## Technical Details

### Files to Edit
1. **`src/pages/admin/setup/EmailTemplatesTab.tsx`** -- Global placeholder system (grouped, clickable), 9 new template types, default HTML bodies for all 25 templates
2. **`src/pages/admin/AdminEmailCompose.tsx`** -- User search from DB, recipient chips, full placeholder sidebar with categories, fix bulk email modes
3. **`supabase/functions/send-smtp-email/index.ts`** -- Add auto invoice number generation (`INV-{date}-{random}`) when `{{invoice_number}}` placeholder is used

### No new migrations needed
All data comes from existing tables (`user_profiles`, `courses`, `enrollments`, `ebooks`, `orders`).


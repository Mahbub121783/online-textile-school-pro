

# Advanced Email Management System with Custom SMTP

## Current State
- Admin UI exists for **SMTP settings** (host, port, user, pass, encryption) stored in `site_settings` table
- Admin UI exists for **Email Templates** (10 template types with HTML editor and placeholders)
- **No actual email sending Edge Function exists** -- the UI saves settings but nothing sends emails
- Your SMTP server: `mail.onlinetextileschool.com`, Port 465 (SSL), Username `info@onlinetextileschool.com`
- Notification system exists (in-app only, no email dispatch)

## What Will Be Built

### 1. Email Sending Edge Function (`send-smtp-email`)
A Supabase Edge Function that:
- Reads SMTP config from `site_settings` table
- Renders email templates with placeholder replacement (e.g., `{{user_name}}` becomes real name)
- Sends via your custom SMTP server (`mail.onlinetextileschool.com:465`)
- Logs every email sent/failed to a new `email_logs` table

### 2. Email Logs Table (new migration)
```
email_logs: id, recipient, subject, template_key, status (sent/failed/pending), 
            error_message, metadata, created_at
```
With RLS policies for admin-only access.

### 3. Email Trigger Helper (`src/lib/emailSender.ts`)
A client-side utility that invokes the Edge Function, used throughout the app:
- `sendTemplateEmail(templateKey, recipientEmail, placeholders)` -- renders template + sends
- Works with all 10+ template types

### 4. Auto-Trigger Integration Points
Wire email sending into existing flows:
- **Order Confirmation** -- after successful payment in `process-payment` Edge Function
- **Order Cancellation/Rejection** -- admin order actions
- **Password Reset** -- already handled by Supabase Auth (uses Supabase's built-in email, but we can customize the template in Supabase dashboard)
- **Welcome Email** -- after new user registration (auth hook)
- **Enrollment Confirmation** -- after enrollment insert
- **Certificate Issued** -- after certificate generation
- **Instructor/Student Approved/Rejected** -- admin approval actions

### 5. Admin Email Dashboard
A new admin page showing:
- Email send logs (filterable by status, template type, date range)
- Stats cards (total sent, failed, pending)
- Resend failed emails button
- Test email button on SMTP settings page (actually sends a test)

### 6. Push/Manual Email Composer
Admin can compose and send one-off emails to:
- Individual users
- All students
- All enrolled students of a course
- Custom recipient list

## Files to Create
1. `supabase/functions/send-smtp-email/index.ts` -- SMTP sending Edge Function
2. `src/lib/emailSender.ts` -- client-side helper to invoke the Edge Function
3. `src/pages/admin/AdminEmailLogs.tsx` -- email logs dashboard
4. `src/pages/admin/AdminEmailCompose.tsx` -- manual email composer

## Files to Edit
1. `src/pages/admin/setup/SmtpSettingsTab.tsx` -- add working "Test Connection" button
2. `src/pages/admin/setup/EmailTemplatesTab.tsx` -- add more template types (registration, push notification)
3. `src/components/layout/AdminSidebar.tsx` -- add Email Logs and Compose links
4. `src/App.tsx` -- add routes for new pages
5. `src/pages/admin/AdminSetup.tsx` -- add email logs tab
6. Various pages where triggers should fire (checkout, enrollment, admin approvals)

## Database Migration
- Create `email_logs` table with admin-only RLS

## SMTP Credentials
Your SMTP password for `info@onlinetextileschool.com` will need to be stored as a Supabase Edge Function secret (not in `site_settings` for security). You'll be asked to provide it during implementation.

## Technical Notes
- The Edge Function uses Deno's SMTP library (`denomailer`) to connect to your mail server
- Templates are fetched from `site_settings` at send time, so admin changes take effect immediately
- Password Reset emails are handled by Supabase Auth natively -- we'll customize the template in Supabase dashboard settings, not via SMTP (Supabase intercepts these before they reach our code)


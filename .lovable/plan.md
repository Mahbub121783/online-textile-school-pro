

# SMTP Fix + Email Logo & Branding Setup

## Issue: Wrong SMTP Settings
Your mail server requires **SSL on Port 465** (shown in your hosting panel), but the admin currently has Port 587 with TLS. The correct settings:

| Setting | Correct Value |
|---------|--------------|
| **Encryption** | SSL |
| **Port** | 465 |
| Host | mail.onlinetextileschool.com |
| Username | info@onlinetextileschool.com |

**Why SSL + 465?** Your hosting provider explicitly states "SMTP Port: 465" with SSL/TLS. Port 587 with STARTTLS is an alternative standard, but your server is configured for implicit SSL on 465. Using the wrong combination will cause connection failures.

## What Will Be Built

### 1. Fix SMTP Defaults
- Change default encryption to `ssl` and default port to `465` in SmtpSettingsTab
- Update the Edge Function's TLS logic to properly handle SSL vs TLS vs STARTTLS

### 2. Email Logo & Branding Settings (New Section in SMTP Settings)
Add a new "Email Branding" card to SMTP settings with:
- **Logo URL** field -- upload or paste URL for your school logo (appears in all email headers)
- **Brand Color** -- primary color for email headers/buttons (default from your theme)
- **Footer Text** -- custom footer text for all emails
- **Social Links** -- optional website, Facebook, etc.

These are stored as `site_settings` keys: `email_logo_url`, `email_brand_color`, `email_footer_text`, `email_social_links`.

### 3. Auto-Wrap Emails with Branded Template
Update the `send-smtp-email` Edge Function to automatically wrap all outgoing emails in a professional HTML template that includes:
- Logo header with brand color background
- Clean content area
- Branded footer with school name, address, social links
- "Powered by Online Textile School" footer

This applies to both template-based and custom/compose emails automatically.

## Files to Edit
1. `src/pages/admin/setup/SmtpSettingsTab.tsx` -- add branding card, fix defaults
2. `supabase/functions/send-smtp-email/index.ts` -- fix TLS handling, add branded wrapper
3. Redeploy the Edge Function

## Technical Notes
- Logo can be a Cloudinary URL or any public image URL
- Brand wrapper is applied server-side in the Edge Function so all emails are consistent
- Existing templates' HTML becomes the "content" section inside the branded wrapper




# Upgrade Privacy Policy and Terms of Service Pages

## Current State
- Both pages exist at `/privacy` and `/terms` with routes configured
- They use basic `prose` styling -- plain text with no visual polish
- Footer links to Privacy Policy but **not** Terms of Service
- Copyright bar has no legal links

## What Changes

### 1. Redesign Both Pages with Advanced UI
Replace the plain prose layout with a modern, card-based design:
- Sticky sidebar table of contents (desktop) for quick section navigation
- Each section in its own Card with icon, numbered badge, and smooth scroll anchors
- Breadcrumb navigation at the top
- Cross-link banner at the bottom (Privacy page links to Terms and vice versa)
- "Last updated" badge styled prominently
- Print-friendly button
- Mobile: collapsible accordion-style TOC

### 2. Update Footer
- Add "Terms of Service" link next to the existing "Privacy Policy" link in Quick Links
- Add both links to the copyright bar at the bottom: `Privacy Policy | Terms of Service`

### 3. Also Add to Google OAuth Branding (Info Only)
Fill in the two empty fields on your Google Branding page:
- **Application privacy policy link**: `https://onlinetextileschool.com/privacy`
- **Application terms of service link**: `https://onlinetextileschool.com/terms`

## Files to Edit
1. `src/pages/static/PrivacyPage.tsx` -- full redesign with sidebar TOC, cards, icons
2. `src/pages/static/TermsPage.tsx` -- same treatment
3. `src/components/layout/Footer.tsx` -- add Terms link + copyright bar links

## Page URLs
- Privacy Policy: `https://onlinetextileschool.com/privacy`
- Terms of Service: `https://onlinetextileschool.com/terms`

## Technical Details
- Uses existing UI components: Card, Badge, Breadcrumb, ScrollArea
- Icons from lucide-react for each section (Shield, Eye, Lock, Cookie, etc.)
- Smooth scroll via `scrollIntoView({ behavior: 'smooth' })` for TOC links
- No new dependencies required


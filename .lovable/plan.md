## Problem (confirmed by live test)

Sharing any link on WhatsApp / Facebook / Messenger / Telegram returns **HTTP 503** from your cPanel server. Reason: `public/.htaccess` proxies bot traffic to the Supabase `og-meta` edge function using Apache's `[P]` (mod_proxy) flag — but **mod_proxy is not enabled** on your LiteSpeed/cPanel host, so the rewrite engine fails for every crawler User-Agent.

Verified just now:
- Browser UA → `200 OK`
- `facebookexternalhit/1.1` UA → `503`
- WhatsApp UA → `503`
- Direct call to the edge function → `200` in ~0.8s (function is healthy)

## Fix

Change the `.htaccess` rule from a server-side proxy `[P]` to a **302 redirect** `[R=302,L]`. Crawlers follow redirects, hit the edge function, and receive the proper OG meta HTML. Real users continue to be served `index.html` by the SPA fallback below.

### File to change
- `public/.htaccess`

### Change
Replace this block:

```apache
RewriteCond %{HTTP_USER_AGENT} (facebookexternalhit|Facebot|Twitterbot|...) [NC]
RewriteCond %{REQUEST_URI} !^/og-default\.png$
RewriteCond %{REQUEST_URI} !\.(png|jpe?g|...)$ [NC]
RewriteRule ^(.*)$ https://kaiiyssrwkapromkfidv.supabase.co/functions/v1/og-meta?path=/$1 [P,L]
```

With:

```apache
RewriteCond %{HTTP_USER_AGENT} (facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Pinterest|redditbot|SkypeUriPreview|vkShare|W3C_Validator|Applebot|bingbot|Googlebot-Image) [NC]
RewriteCond %{REQUEST_URI} !^/og-default\.png$
RewriteCond %{REQUEST_URI} !\.(png|jpe?g|webp|gif|svg|ico|css|js|woff2?|ttf|json|xml|txt|pdf|mp4)$ [NC]
RewriteRule ^(.*)$ https://kaiiyssrwkapromkfidv.supabase.co/functions/v1/og-meta?path=/$1 [R=302,L]
```

Only the last line changes: `[P,L]` → `[R=302,L]`.

## Why this works

- **Crawlers (FB/WA/etc.)** follow 302s by default. They land on the Supabase edge function, get a 200 with full OG/Twitter/JSON-LD tags, and render the preview correctly.
- **Real users** never match the bot User-Agent regex, so they keep getting `index.html` (SPA fallback) — direct clicks from WhatsApp/Messenger work normally because the messaging apps' in-app browsers send a normal browser UA, not a bot UA.
- **No server modules required** — works on every Apache/LiteSpeed/cPanel setup.

## Deployment note

`public/.htaccess` is shipped to your cPanel host as part of the production build. After this change is published (Publish → Update), redeploy/upload the new `public_html/.htaccess` (or wait for your normal deploy pipeline) so the live server picks it up. Then re-test with:

```
curl -I -A "facebookexternalhit/1.1" https://onlinetextileschool.com/
```

Expected: `302` → follow to Supabase → `200` with OG tags. You can also use Facebook's Sharing Debugger (`developers.facebook.com/tools/debug/`) to clear the cached 503 and verify the new preview.

## Result

- Link previews show correct title/description/image on WhatsApp, Messenger, Facebook, Telegram, LinkedIn, Slack, Discord, Twitter.
- Clicking the shared link opens the page normally instead of an error.
- No code changes needed in React, edge functions, or the database — the `og-meta` function is already returning the right HTML.

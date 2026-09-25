# Online Textile School

Self-hosted LMS for Online Textile School — courses, workshops, eBooks, live classes, campus network, and a question bank, serving [www.onlinetextileschool.com](https://www.onlinetextileschool.com).

## Stack

- **Frontend**: React + Vite + TypeScript, deployed as a static build to cPanel.
- **Backend**: Node.js/Express (`backend/`), running as the API at `api.onlinetextileschool.com`.
- **Database**: self-hosted PostgreSQL on cPanel, with Row-Level Security. Schema/migrations live in `db/`, applied in order via `psql`.
- **Data access**: the frontend talks to the backend through the `@supabase/supabase-js` client (`src/integrations/supabase/`), pointed at the self-hosted Postgres/REST API rather than Supabase's cloud service.

## Development

```
npm install
npm run dev
```

## Build & deploy

```
npm run build
```

Deployment is manual (SSH/`scp` to cPanel) — see `.github/workflows.disabled/README.md` for why automatic deploy is currently disabled and how to deploy by hand.

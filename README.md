# EG Brandsync Make

Source extraction of the **Brandsync Make** feature — a Figma-Make-style UI generator that drops into the EG-A-S Next.js frontend. This repo is a curated snapshot of the new files; it is **not a runnable standalone app**. To run it, drop the trees into the host EG-A-S `frontend/` codebase.

## What's here

```
src/
├── app/
│   ├── brandsync-make/                       Next.js route tree
│   │   ├── page.js                           Landing screen ("What do you want to make?")
│   │   ├── layout.js
│   │   ├── components/page.js                Standalone components index
│   │   └── my-patterns/page.js               Workspace (sidebar + canvas + Monaco source editor)
│   └── api/
│       ├── projects/                         GET list / POST create
│       │   └── [id]/                         GET detail
│       │       └── files/                    POST add  ·  DELETE remove (by fileId)
│       ├── my-patterns/                      GET list  ·  DELETE / PATCH (rename)
│       ├── generate/                         501 stub — wire to an LLM later
│       ├── components/                       Strapi proxy (local-first, prod fallback)
│       └── product-logos/                    Strapi proxy (logos)
├── feature/brandsync-make/                   React UI
│   ├── BrandsyncMakePage.jsx                 Landing page body
│   ├── ProjectsDialog.jsx                    "Open project" dialog
│   ├── HandoffDialog.jsx                     Jira handoff picker (stub)
│   ├── PatternsDialog.jsx                    Brandsync patterns picker
│   └── ComponentsDrawer.jsx                  Right-side component library drawer
└── lib/
    ├── db.js                                 Shared pg pool + auth helpers
    └── brand-substitute.js                   Logo / palette substitution helpers
```

## Host app dependencies

This code expects the EG-A-S frontend to provide:

- **Next.js 15** App Router (`'use client'` boundaries used throughout)
- **MUI 7** (`@mui/material`) — the landing page + dialogs use MUI
- **@phosphor-icons/react** + **phosphor-react** — icons
- **@monaco-editor/react** — source-mode editor
- **`pg`** — Postgres client for the API routes
- **brandsync-tokens** npm package (loaded as `/brandsync-tokens.css`) — CSS variables (`--bs-*`)
- The host's site `Header` + `Footer` + layout chrome
- `@/api/design-system/*` clients for product logos

## Backend / data dependencies

- **Supabase Postgres** (or any Postgres) with three new tables:
  - `users` — already in the EG schema
  - `corpus_entries` — patterns table; new `user_id` column for per-user scoping
  - `projects` (new) — `id uuid PK, name text, user_id text FK users, created_at, updated_at`
  - `project_files` (new) — `id uuid PK, project_id uuid FK, corpus_entry_id uuid FK, added_at; UNIQUE (project_id, corpus_entry_id)`
- **Strapi 5** — local instance for `components` + `product-logos` proxies (falls back to prod if unreachable)

Required env vars (`.env.local`):

```
DATABASE_URL=postgresql://...                Supabase connection string (server-side only)
STRAPI_API_TOKEN=...                         Local Strapi token
STRAPI_API_PROD_TOKEN=...                    Prod Strapi token (fallback)
NEXT_PUBLIC_STRAPI_API_URL=http://localhost:1337/api
```

## Auth model

Identity is passed as `?userEmail=<email>` on each request — a local-dev placeholder. Production should swap for Keycloak JWT verification or Supabase RLS; every `'vivka@eg.dk'` literal in `my-patterns/page.js` is a swap point.

## What `/api/generate` does today

Returns **HTTP 501** with a message pointing the user to drive generation via the Claude Code chat. The frontend's send button + transcript surface this gracefully. To wire a real LLM, replace the stub handler — keep the response shape `{ pattern, edited, projectFile, contextUsed, usage, model }` and the rest of the pipeline doesn't change.

## Notes

- `feature/brandsync-make/ComponentsDrawer.jsx` includes:
  - SVG → Phosphor web-font icon substitution (with class-aware skip rule for component-internal SVGs)
  - Emoji → Phosphor mapping (for components shipping emojis as icons)
  - Local overrides for Navigation Drawer + Navigation Header (cleaner than the prod-shipped versions)
  - Iframe interactive shim (accordion toggle, checkbox indeterminate init)
- `src/lib/brand-substitute.js` handles `{{logo}}` / `{{logo-icon}}` / `{{product-name}}` placeholders
- The 14-step brand-color palette catalog (blue, cobalt, purple, …) is in the same lib

Extracted on 2026-05-26.

# Features

Feature-based modules. Each `features/<domain>/` owns a vertical slice of one
product area — its page(s), components, hooks, services, and types.

## Why route files stay in `app/`

Next.js App Router derives routes from the filesystem, so `page.tsx` /
`layout.tsx` **must** live under `src/app/`. Those files stay as **thin
wrappers** that re-export from the matching feature module:

```tsx
// src/app/lms/pages/profile/page.tsx
export { default } from "@/features/profile/ProfilePage";
```

The actual implementation lives in `src/features/profile/`.

## Conventions

- `features/<domain>/<Domain>Page.tsx` — the page component (add `"use client"`
  here if it needs client APIs; the `app/` wrapper stays a server module).
- `features/<domain>/components/` — components used only by this feature.
- `features/<domain>/api.ts` (or `services/`) — the feature's data access.
- `features/<domain>/types.ts` — feature-local types.
- Import across the app via the `@/features/<domain>/...` alias — never relative
  `../../` paths, which silently break when a file is relocated.

## Migrated so far

- `profile`
- single-page: `businessmanagement`, `compailer`, `compailer1`, `dashboard`,
  `instutionmanagement`, `notifications`, `pedagogy`, `users`
- multi-route: `logs`, `studentdashboard`, `attendancemanagement`
- component-feature: `questionbanks`, `dynamicfieldsettings`, `clientmanagement`

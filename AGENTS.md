# AirDesign

`apps/site` is the marketing and sign-in site, built with Astro 7 and Tailwind 4. It ships as static files on the Cloudflare Worker `airdesign-landing`, which owns all of airdesign.app and www.airdesign.app. Requests that match no built file go to `apps/site/worker/old-deployment-passthrough.ts`, which forwards the paths it lists to the older deployment and returns 404 for the rest.

## Map

Paths are relative to `apps/site/src`.

| URL | Page | Feature code |
|---|---|---|
| `/` | `pages/index.astro` | `landing/` has one folder per section: `header`, `hero`, `product-demo`, `agents`, `pricing`, `footer` |
| `/sign-in` | `pages/sign-in.astro` | `access/sign-in/` |
| `/sign-in/check` | `pages/sign-in/check.astro` | `access/check-email/` |
| `/sign-in/expired` | `pages/sign-in/expired.astro` | None, the page holds it all |

`site/` holds what every page shares: the document shell, the theme, the brand mark and the check icon.

## Where to change things

- Colors, easing and every shared CSS class: `site/site-theme.css`.
- Product demo timing, cursor path and typing speed: the constants and the `cues` table at the top of `landing/product-demo/editor-demo-animation.ts`.
- Product demo content: `landing/product-demo/editor-demo-markup.html`. Search tools skip this 84 KB file through `apps/site/.ignore`, so pass its path explicitly and search for a `data-demo-part` name from the `cues` table. Do not read it whole.
- Nav highlight per section: `landing/header/active-section-highlight.ts`.
- Sign-in email handoff between pages: `access/pending-sign-in-email.ts`.

## Commands

Run these in `apps/site`.

- `pnpm dev` starts the local site.
- `pnpm build` builds to `dist`.
- `pnpm run deploy` builds and publishes to Cloudflare. Pushing to `main` deploys nothing.

## Rules

- Code has no comments. If code needs explaining, use a better name.
- Copy and layout follow the design. Screens are on the `planning/v0.1` branch at `docs/design/v0.1/screens/<screen id>.png`, for example `git show origin/planning/v0.1:docs/design/v0.1/screens/S21.01-access-sign-in-default.png`.
- With reduced motion on, every page shows its finished design with no movement.
- Sign-in has no backend yet. The form keeps the email in `sessionStorage` and sends nothing.

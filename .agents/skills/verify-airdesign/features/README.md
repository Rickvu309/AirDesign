# AirDesign verification map

This directory is the maintained source for verifying what an AirDesign user does. Read this index before driving the app, then use the matching feature file as the recipe. Driving commands are in `../SKILL.md`; below, `V` is `.agents/skills/verify-airdesign/bin/verify-airdesign.mjs`, run from the repo root.

## Every merge runs every journey

The `journeys` workflow (`.github/workflows/journeys.yml`) runs `pnpm test:journeys` on every push to `main`: it builds `apps/api` and `apps/web` once, launches one stack with `$V launch --no-build`, runs every journey in `journeys/` against it through `tests/journeys/journeys.spec.ts`, and stops the stack. A failure opens or comments on the issue `journey failed on main`, naming the journey, the commit and the run; the next passing push closes it. It does not run on pull requests and blocks no merge. Run the same thing locally with `pnpm test:journeys` from the repo root. A new journey file is driven in that suite once it is listed in `tests/journeys/journeys.spec.ts`.

## Baseline preconditions

- `$V launch` printed a run id and `$V doctor <run>` printed `"ok":true`.
- The run is yours. Never drive an instance another run or agent started.
- The database starts empty: no accounts, no decks. Each journey signs in a new account, so journeys do not depend on each other.
- Fixtures come from `scripts/pptx-fixtures/`. `clean.pptx` is one slide with one text box reading `Hello`.

## Driving conventions

- Start each journey from Home `/` as a signed-in person, the way a user arrives.
- Prefer roles and accessible names, then the app's data attributes (`data-slide-paint`, `data-canvas-element`, `data-slide-entry`), then `input[type=file]` and `[contenteditable="true"]`.
- Take every API path from `deckRoutes` or `signInRoutes`. Never type one.
- The app paints before the network. After a UI action, wait for the server copy with `expect.poll` on `deckRoutes.open` or `deckRoutes.list` before you call it saved.

## Proof and skip reporting

- Capture the action and the resulting state: a screenshot and ARIA snapshot after each step (`capture`), and the API answer that shows the stored result (`post`).
- Every feature that changes data proves it through a second view: the server copy, Home after a reload, or Trash.
- `proof.md` in the run's evidence dir records the commit, each step's note and the journey's result. Quote its path.
- When an entry point is not reachable in this stack, report it as not verified with the reason. Do not report it as verified through another path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing what the user sees. It then has exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-airdesign`, `Gotchas`.

## Features

- [Open a PowerPoint and edit its text](./open-edit-save.md): import from Home, type in the slide, the server keeps the text, reopening shows it. Journey `open-edit-save`.
- [Deck list and Trash](./deck-list-trash.md): Home lists the person's decks, Move to Trash, Restore, Empty Trash. Journey `deck-list-trash`.
- [Slide paint](./slide-paint.md): the opened deck paints each element at its place on a slide of the right shape. Journey `slide-paint`.
- [Reopen in a cleared browser](./cleared-browser.md): after IndexedDB, local storage and site files are cleared, the saved deck still shows its slide. Journey `cleared-browser`.
- [Delete account](./delete-account.md): the account menu deletes the account after the person types its email; the server, the stored originals and the browser keep nothing of it. Journey `delete-account`.
- [Sign in](./sign-in.md): email, six-digit code, session cookie, signed-out redirect. Command `$V sign-in`.

# AirDesign

AirDesign makes slide decks from an idea or a PowerPoint. A person and their AI agents edit a deck together, and it exports back to PowerPoint with no loss.

## What we never compromise

1. **No-loss PowerPoint.** Content nobody touched survives byte for byte. Real PowerPoint is the judge, not our own re-import.
2. **The user's machine does the work.** Painting, import, export, capture and the agent loop run on the device. The server keeps the order of edits, storage, the Claude key and the MCP address.
3. **One path for agents.** A person connects their own agent over MCP or uses Aira. Both get the same tools, permissions and limits.
4. **An edit paints before the network.**

Prefer the simple system. Do not keep complexity because it exists, or add machinery because it looks impressive. Fight scope creep.

## Commands

- `pnpm check` runs exactly what CI runs. Run it after your last edit, before every push. Never `--no-verify`.
- `pnpm new:package <name>` creates a workspace package. Do not build one by hand.
- `pnpm dev` inside `apps/web` or `apps/site` starts that app.
- `pnpm run deploy` inside `apps/site` publishes the site. Merging to `main` deploys nothing.

`main` only accepts commits that passed the `gate` check, so every change goes through a PR. After opening one, run `gh pr merge --auto --rebase`. It merges when `gate` passes, and rebase keeps commit authorship. After it merges, remove its local worktree and branch if nothing else uses them.

## Ways to hurt yourself

1. **Searching the demo markup.** `apps/site/src/landing/product-demo/editor-demo-art.html` is 84 KB, and search tools skip it. Pass its path and search for a `data-demo-part` name. Do not read it whole.
2. **Breaking old production.** `studio.` and `mcp.airdesign.app` still run the old backend. `apps/site/worker/old-deployment-passthrough.ts` forwards the paths it lists to it.
3. **Treating screens as a working app.** `apps/web` screens are static with sample data, and sign-in sends nothing. Nothing saves yet.

## Where code lives

- `apps/site` is the marketing and sign-in site. Color, type, space and motion live in `packages/theme`. Site classes stay in `src/site/site-theme.css`.
- `apps/web` is the product UI. Product screens go here, never in `apps/site`. Each designed state is a page at `/screens/<id>-<name>`, registered in `src/<area>/<area>-screens.tsx`. Use shadcn parts, Sonner for toasts, and AI Elements for agent chat.
- `packages/*` are shared packages. The build refuses a deep import, an undeclared dependency, or a browser or Node API in a pure package.

## Rules

- Code has no comments. If code needs explaining, use a better name.
- Never name a file or folder `utils`, `helpers` or `common`. Name it after what it contains.
- Use one word per idea, everywhere. The same name appears in the code, the test and the tool, so one search finds all of it.
- Every package exposes only its `index.ts`, and tests sit beside the code. `@airdesign/theme` also exposes `tokens.css`.
- Extend what exists before building a parallel version.
- Copy follows the existing screens. Do not invent product copy. Layout follows the tokens in `packages/theme` and the components in `apps/web/src/components/ui/`. Add a missing role to the token file.
- With reduced motion on, a page shows its finished state with no movement.
- Test behavior that can break, at the lowest layer that fails. Tests never retry.
- Do not commit plans, research notes or scratch files. A merged PR is the record.

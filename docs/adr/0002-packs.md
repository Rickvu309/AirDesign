# AirDesign is a modular monolith of packs, checked by ts-packwerk

Many agents change AirDesign at once, and they rewrite whole areas often. Before this record, `packages/*` had real boundaries (pnpm, `exports` maps, compile fixtures), but inside an app any file could import any other: `apps/api/src` was 82 flat files, and the `@/*` alias let any file in `apps/web/src` reach any other. An agent rewriting one area could not see its contract, and nothing stopped a new reach across areas. The owner chose a modular monolith in the style of Shopify's Packwerk, with our own TypeScript checker, on 2026-11-22.

A pack is a folder with a `pack.yml`. It owns every file below it, down to the next pack. [ts-packwerk](https://github.com/Rickvu309/ts-packwerk), our open-source checker and a devDependency here, reads every import with oxc, resolves it like TypeScript and Node, and `pnpm check:boundaries` fails a reference that breaks a pack's rules: a dependency it does not declare, a file another pack keeps private, a higher layer, or a Postgres table another pack owns. `package.json` governs references between workspace packages; `pack.yml` governs references inside one. `packwerk.yml` ranks layers from top to bottom: `app`, `feature`, `shared`, `platform`, then the workspace packages: `service` (`live`, `mcp`), `model` (`document`, `catalog`, `render`, `pptx`) and `core` (`doom`, `theme`, `fonts`, `device`, `oauth`, `usage`, `templates`). Each package is a pack whose public file is `src/index.ts`, so a package can use only a package at its own layer or below, and Doom, at `core` with no dependencies, uses none.

The api is a root pack over seven packs: `platform`, `account`, `oauth`, `usage`, `aira`, `doom` and `mcp`, with each table owned by one. The web is a pack per folder. The editor is the `editor` feature; it uses the slide paint, canvas fit and picture code in `editing`, which `present` shares. Test files and `testing/` folders are checked with the pack that owns them. A test may import that pack's private files. Four source-reading tests stay in `test_exempt`.

## Considered options

- Keep the boundaries where they were and fix leaks by hand: no cost now, but the flat api and the `@/*` alias keep hiding new reaches, and an agent has no contract to read.
- Shopify's packs everywhere, including vertical packs across browser, server and PowerPoint code: rejected, because it erases the compile-time line between browser and server packages and puts three quarters of the repo in one pack.
- Mass moves to a target tree before any check (zero todos per wave): rejected, because the web folders change every hour and giant moves would conflict with every other branch. Packs sit on the folders that exist, today's violations are recorded in `pack_todo.yml`, and later moves shrink them.
- One package per module, or subpath exports per domain in `document` and `catalog`: not now. `package.json` already guards packages, and splitting the hottest barrels would cost every open branch a conflict for a gain nobody has measured.
- An outbox or event bus between api modules: rejected. Modules call each other through typed functions inside one process and one Postgres.

## Consequences

- `ts-packwerk explain <folder>` tells an agent a pack's layer, public files, declared dependencies and what uses it, before it changes the pack.
- A new violation fails the check with its next step. `update-todo` only removes fixed entries; recording all of them takes `--all`, so a todo file only shrinks. `todo_ceiling` in `packwerk.yml` is the number of recorded entries, and `pnpm check:boundaries` fails when that number is above the one on `origin/main`.
- The check takes about 1 s on 1,400 files, tests included, and runs in `pnpm check:boundaries`.
- Table names count only inside string and template literals, so a property such as `deck.id` never matches. Migrations, schema setup and role provisioning are exempt. Tests at the api root and in `apps/api/src/testing` test the whole app and may name any table; a pack's own tests name only the tables it owns.
- The delete-account test lists every table in the `session` and `deck` schemas, so a module that adds a table must say how an account's rows leave with it.

# A shipped migration is never edited; a change is a new migration

`apps/api/src/platform/frozen-migrations.test.ts` checks each migration's exact sql against `apps/api/src/platform/frozen-migrations.json`, and `scripts/frozen-migrations.mjs` only appends

A new migration is a new file in `apps/api/src/platform/migrations/` named `<four-digit id>-<what it does>.ts`, exporting its sql as `sql`; the number is its id, after migration 24. `numbered-migrations.ts` reads the folder, and `tsc` builds it into `dist` with the rest of the api, so the deploy's setup step runs it.

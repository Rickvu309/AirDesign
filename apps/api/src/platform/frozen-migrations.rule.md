# A shipped migration is never edited; a change is a new migration

`apps/api/src/platform/frozen-migrations.test.ts` checks each migration's exact sql against `apps/api/src/platform/frozen-migrations.json`, and `scripts/frozen-migrations.mjs` only appends

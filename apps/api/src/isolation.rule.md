# A test file sees only the rows it wrote

`postgresInfo` in `apps/api/src/harness.ts` gives each `apps/api` test file its own database, cloned from the template the globalSetup prepares; `scripts/vitest-api-database.mjs` drops it after each file; `isolation.test.ts` fails when it sees another file's rows

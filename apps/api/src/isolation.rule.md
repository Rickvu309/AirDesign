# A test file sees only the rows it wrote

`postgresInfo` in `apps/api/src/harness.ts` gives each `apps/api` test file its own database, cloned from the template the globalSetup prepares; `scripts/vitest-api-database.mjs` drops it after each file; `isolation.test.ts` fails when it sees another file's rows

The Aira ask migration test creates its own unmigrated database from `template0` on the cluster the suite already started. It uses the cluster's existing roles and drops its database when done. `aira-ask-migration.test.ts` checks that the fixture uses the suite's cluster and can apply migrations starting from an empty schema.

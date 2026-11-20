# A ci job that runs the database tests, the PowerPoint check, corpus or paint fidelity gets PostgreSQL from the one action before it runs them

`scripts/ci-postgres.test.mjs` fails a check, pptx, corpus, paint-fidelity, journeys or mutation job that has no `./.github/actions/postgres` step first

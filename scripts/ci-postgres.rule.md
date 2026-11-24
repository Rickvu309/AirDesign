# A ci job that runs the database tests, or the PDF check gets PostgreSQL from the one action before it runs them

`scripts/ci-postgres.test.mjs` fails a check, PDF, journeys or mutation job that has no `./.github/actions/postgres` step first

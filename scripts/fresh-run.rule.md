# A failed ci job is never rerun; one fresh run per head if it failed outside the diff

`pnpm land` prints if `main` moved (`land-report.mjs`); when only browser or journeys tests outside the diff fail, it comments and reopens or requeues (`fresh-run.mjs`). `ci` fails attempt 2+

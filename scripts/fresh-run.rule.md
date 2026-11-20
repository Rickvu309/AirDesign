# A failed ci job is never rerun; one fresh run per head if it failed outside the diff, only after each failed test is recorded as a race issue

`pnpm land` prints if `main` moved (`land-report.mjs`); when only browser or journeys tests outside the diff fail, it records each as a `Race:` issue (`recordRaces` in `fresh-run.mjs`), then comments and reopens or requeues; a failed test the diff changes takes no fresh run and says to force the gap. `ci` fails attempt 2+

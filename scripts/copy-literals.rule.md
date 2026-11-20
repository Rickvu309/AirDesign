# Tests take product words from `apps/web/src/copy`; existing duplicate literals are counted and additions per file and value fail with the export to import

The `copy-in-tests` step covers browser tests, journeys and verify-airdesign journeys and look states

The scan reads the `origin/main` version only of the files the diff or the working tree changed, so its git calls stay the same however many tests there are (`copy-literals.test.mjs` counts them)

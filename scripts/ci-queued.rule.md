# Push ci reuses only successful queue ci for the exact main commit, independent of performance caches

`scripts/ci-queued.test.mjs` runs the action on absent, failed, different-SHA, wrong-event, wrong-workflow and failed lookups; all keep work required, so with no merge queue the push to `main` runs every part. Source, scripts, browser and PDF skip on a push if the merge queue passed for that commit. Design runs on PRs (`scripts/ci-parts.test.mjs`)

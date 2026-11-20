# Push ci reuses only successful queue ci for the exact main commit, independent of performance caches

`scripts/ci-queued.test.mjs` runs the action on absent, failed, different-SHA, wrong-event, wrong-workflow and failed lookups; all keep work required, so with no merge queue the push to `main` runs every part. Main, side, browser, corpus and pptx skip on verified success; queue corpus covers pptx. Design stays PR-only and paint stays independent (`scripts/ci-parts.test.mjs`)

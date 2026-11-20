# Journeys judge a PR before the merge

`ci` calls `journeys.yml` on PRs and in the merge queue when there is one, and requires success or skipped. The reusable workflow keeps manual dispatch, has no push trigger and opens or closes no issues (`scripts/ci-parts.test.mjs`)

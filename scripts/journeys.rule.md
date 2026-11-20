# Journeys judge a PR before the merge

`ci` calls `journeys.yml` on PRs and in the merge queue when there is one, and requires success or skipped. The reusable workflow keeps manual dispatch, has no push trigger and opens or closes no issues (`scripts/ci-parts.test.mjs`)

Each shard launches its own stack and uses `weightedShares` on the seconds in `tests/journeys/journey-seconds.json`. Journeys without a record weigh the median. A passing local run of the whole suite records new journeys and refreshes timings that moved past half or double their record. The recorded Aira journeys still run in order within each stack. The workflow runs two shards: three samples each of two, three and four shards on GitHub runners gave a slowest shard of 193, 158 and 133 s, and at two the `source` job, 364 s, is the slowest job, so more shards add runner minutes and no earlier finish.

When the change map finds only named journeys to run, `ci` passes those names to a single shard. A change to an app or to shared journey setup keeps the whole suite. A look state that walks a changed journey still reaches design. `change-map.test.mjs`, `journey-shards.test.mjs` and `ci-parts.test.mjs` hold the selection and workflow.

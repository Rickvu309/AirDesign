# On PRs the design scans run in a job per 200 states, `design-findings` judges all their reports, and other browser tests run in four shards

`--part=design --shard=<n>/<total>` sweeps its share (`look/states.test.mjs`), `--part=browser --shard=<n>/4` skips the scans, `--part=findings` fails on a lost report. `design-shards.test.mjs` and `ci-parts.test.mjs` hold the jobs

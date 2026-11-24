# Browser shards split spec files by their recorded seconds, and each file runs in exactly one shard

`tests/browser/spec-seconds.json` holds each spec's seconds. `--part=browser --shard=<n>/<total>` hands the heaviest file to the lightest shard, and a file with no record weighs the median. A local `pnpm test:browser` that passes whole files measures them into the untracked `spec-seconds.measured.json` beside the record, and `pnpm timings` folds that in (`scripts/timings.rule.md`). `spec-seconds.test.mjs`, `browser-timings.test.mjs` and `ci-parts.test.mjs` hold the split

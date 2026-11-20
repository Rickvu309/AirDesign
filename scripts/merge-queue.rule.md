# `pnpm land` reads from GitHub whether `main` has a merge queue, and arms auto-merge only when it does

`main` has a queue only when GitHub answers a `mergeQueue` for it and an active ruleset puts a `MERGE_QUEUE` rule on `refs/heads/main`, both read in the one pull request query; nobody sets a flag. With a queue, land reads the queue back and stops when the PR is neither queued nor armed. With none, it never arms auto-merge, switches off an armed one so GitHub cannot merge without the recheck, and takes a fresh run by closing and reopening without arming (`scripts/merge-queue.mjs`, `merge-queue.test.mjs`, `land-follow.test.mjs`, `fresh-run.test.mjs`, `land-recheck.test.mjs`)

The wait for a first check says which state it is in: with a queue it says land arms auto-merge and the queue takes the head once ci passes; with none it says land arms nothing and merges the head itself after its recheck

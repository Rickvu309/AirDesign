# Stopping a verify run touches only runs of this worktree, found by an `owner` file each run gets before any process starts

`leftover-runs.test.mjs` lists a worktree's runs and names the owner of another's. `verify-airdesign stop` refuses a run another worktree started

A run's owner is the real path of the worktree that launched it, and nothing outside the launch sets it. `launch` removes its own half-started run, with Postgres, on any failure or signal; `serve` releases Postgres on any failure or signal after it starts (`launch-cleanup.test.mjs`). `before-after` and `bench` launch a base run in a scratch tree, which owns it, and on success, failure, SIGINT or SIGTERM stop every run they started as the tree that owns it and remove every scratch tree (`proof.test.mjs`)

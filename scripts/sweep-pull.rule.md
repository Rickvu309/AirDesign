# Land removes a merged pull request's own worktrees and branch

After `pnpm land` confirms the pull request is merged, it calls `sweepPull` in `scripts/sweep.mjs` with that merged head. `sweepPull` uses the worktree remover in `scripts/worktrees.mjs`. Every git command runs in the main checkout.

It removes a worktree on the head branch, and that local branch, only when the tip is the merged head or an ancestor of it. Anything else stays, and the remover prints the command that would remove it. It removes a detached verify-airdesign scratch tree only when `base` resolves, the commit is on that branch, the commit is not on `base`, and the commit is the merged head or an ancestor of it. A missing `base` removes no scratch trees.

It leaves the main checkout, the directory land is running in, a locked worktree, a worktree a process is using, a worktree a git operation is in progress in, and a worktree with uncommitted changes. It prints one command for each. Deleting the directory land is running in makes `process.cwd()` throw and the next command started in that path fail, so that worktree stays. `pnpm sweep` removes it once it has been quiet and no process is using it. The remover does not use the idle-with-no-work rule. `scripts/sweep.test.mjs`, `scripts/sweep-pull.test.mjs` and `scripts/land.test.mjs` hold this.

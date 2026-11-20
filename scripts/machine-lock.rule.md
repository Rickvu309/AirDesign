# Abandoned or replaced waiters leave the check queue; holders finish

`scripts/machine-lock.test.mjs` kills a launcher two levels up, replaces a waiter from the same worktree, and keeps holders running

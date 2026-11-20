# Finished worktrees and branches are swept safely

`pnpm sweep` lists merged, closed and scratch work; `--apply` removes it. `scripts/worktrees.mjs` guards live processes, dirty files and 3-hour activity; tests cover each

The gate's `sweep-list` step passes `--at-most-every=30`: within 30 minutes of the last list on this machine it prints one line and lists nothing, so many agents gating at once do not each walk every worktree and branch (`scripts/sweep.test.mjs`)

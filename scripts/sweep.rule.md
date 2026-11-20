# Finished worktrees and branches are swept safely

`pnpm sweep` lists merged, closed and scratch work; `--apply` removes it. `scripts/worktrees.mjs` guards live processes, dirty files and 3-hour activity; tests cover each

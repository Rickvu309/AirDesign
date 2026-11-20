# A conflict with `main` is found before the gate; no conflict marker is committed

`pnpm land` runs `git merge-tree` before the push. The `conflict-markers` step warns for now and blocks nothing

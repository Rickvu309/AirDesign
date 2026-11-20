# A commit rebuilt from a stale tree does not undo other people's work: a branch does not put files back to content `main` has since replaced, unless its commit body says `Reverts: <path>`

`pnpm land` stops before the gate (`scripts/stale-tree.mjs`). The `restored-files` step warns for now and blocks nothing

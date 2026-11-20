# A commit is authored by the owner and has no `Co-authored-by` trailer or AI attribution line; a PR body has no "Generated with" line

`scripts/commit-authors.mjs` refuses the commit. `pnpm land` refuses that line in a body file or an open pull request before the gate and names it

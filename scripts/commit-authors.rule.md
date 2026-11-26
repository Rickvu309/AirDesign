# A commit is authored by the owner and has no `Co-authored-by` trailer or AI attribution line; a PR body or agent comment has no "Generated with", "responding on behalf of" or sol-loop review line

`scripts/commit-authors.mjs` refuses the commit. `pnpm land` refuses that line in a body file or an open pull request before the gate and names it. `verify-airdesign comment` refuses a comment that carries one

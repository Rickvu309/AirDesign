# Agent-written files over 5,000 tokens cannot grow; new files stay below it. A token is four bytes

`file-growth` step blocks on a pull request and on this machine, and after the pull request, in the merge queue and on the push to `main`, only warns, so two pull requests that each passed cannot turn `main` red together (`verdict: "warn-after-pr"` in `scripts/check-steps.mjs`, `check-steps.test.mjs`)

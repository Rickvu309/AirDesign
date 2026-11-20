# A red main is reverted to green by a machine, never for a race: the first red commit is reverted when its failure is real, and a race is recorded instead

`scripts/red-main-revert.mjs` and its verdict in `scripts/red-main-verdict.mjs`, run by `.github/workflows/red-main-revert.yml` each time `ci` completes on `main` or on a `red-main/revert-<sha>` branch, and tested on real red runs in `scripts/red-main-revert.test.mjs`.

- The first red commit is the first commit after the last push run that passed, or after the red run just before the first real failure, read in `main`'s first-parent order. A red run waits while a run before it still runs.
- A failure is real when a check step that is not a test step failed, when a PowerPoint check other than the browser export spec failed, when a unit or script test failed that no open `Race:` issue names, when a browser test failed whose file or harness the run's new commits change, or when the same test also failed in the red run before.
- A failure is a race when every failed test has an open `Race:` issue, or is a browser test the run's new commits cannot reach. The bot records each with `recordRace` and reverts nothing.
- A run whose log names no failed test or step reverts nothing.
- The revert is a pull request opened as the owner with `RED_MAIN_TOKEN`, so `ci` and `bar` judge it like any other. Its body starts with the agent line, names the failed jobs and tests from `failureLines`, links the red run and the last green one, and names the reverted pull request. When `bar` would call it lowering the bar, the bot countersigns it, because it puts back the bar `main` had before that commit.
- The bot merges the revert when its `ci` passes and no push run after the reverted commit has passed. It closes the revert when one has: someone fixed forward. It never reruns `ci`, reverts a revert, or opens a second revert of one commit.
- Each verdict is a comment on the `main is red` issue through `scripts/red-main.sh`.

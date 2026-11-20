# A red main is reverted to green by a machine, never for a race: a certain red reverts the first red commit at once, a suspect red waits for a second red on the same test, and a race is recorded instead

`scripts/red-main-revert.mjs` and its verdict in `scripts/red-main-verdict.mjs`, run by `.github/workflows/red-main-revert.yml` each time `ci` completes on `main` or on a `red-main/revert-<sha>` branch, and tested on real red runs in `scripts/red-main-revert.test.mjs`.

- The first red commit is the first commit after the last push run that passed, or after the red run just before the first red the bot acts on, read in `main`'s first-parent order. A red run waits while a run before it still runs.
- A red is certain when a check step that is not a test step failed, such as typecheck, lint or the build, when a PowerPoint check other than the browser export spec failed, when a failed test's own file is in the commits the run tests, when a unit or script test failed that no open `Race:` issue names, or when the same test also failed in an earlier red run of the streak. The bot opens the revert and merges it once its `ci` passes while `main` is still red. A certain red cannot be a race, so waiting would only keep `main` red longer.
- A red is a suspect when every failed test is a browser or journeys test whose file the commits do not change, so the commits reach it only through app code. One red there may be a race, and a revert of a good commit costs its author a land. The bot opens the revert at once, since an open pull request costs nothing, but merges it only once a later push run on `main` fails the same test: two independent reds on one test confirm it. When a later push run passes first, the bot closes the revert and records each suspect test that failed only once with `recordRace`.
- A failure is a race when an open `Race:` issue names every failed test. The bot comments on that issue and reverts nothing. The same test failing again in the next red run is certain.
- A `Race:` issue is keyed by the test's file and title, never its line, so an edit above the test keeps one issue. An issue titled with a line still takes the comment.
- A run whose log names no failed test or step reverts nothing.
- The revert is a pull request opened as the owner with `RED_MAIN_TOKEN`, so `ci` and `bar` judge it like any other. Its body starts with the agent line, names the failed jobs and tests from `failureLines`, links the red run and the last green one, names the reverted pull request, and says whether it waits for a second red. When `bar` would call it lowering the bar, the bot countersigns it, because it puts back the bar `main` had before that commit.
- The bot merges a revert when its `ci` passes and the red is certain, from whichever comes last: the revert's `ci` or the push run that confirms the red. It closes the revert when a push run after the reverted commit passes. It never reruns `ci`, reverts a revert, or opens a second revert of one commit.
- Each verdict is a comment on the `main is red` issue through `scripts/red-main.sh`.

## Drill the live revert path

Run `gh workflow run red-main-revert.yml -f drill_sha=<full-sha>` and follow the dispatch with `gh run watch <run-id>`. Pick a small docs-only commit from the last 300 first-parent commits on `main` whose changes still apply in reverse.

The drill uses the same revert, push and PR creation code with `RED_MAIN_TOKEN`. The agent line and drill marker identify the PR. Each run gets its own `red-main/drill-<sha>-<run-id>-<attempt>` branch, outside the automatic merge trigger. The workflow waits for both `ci` and `bar` to start on the PR's head, then closes the PR and deletes the branch. If a check fails to start within five minutes, it still cleans up and reports failure.

Verify the PR author, the two workflow links, the closed PR and the deleted branch. The bot comments on the open `main is red` issue. If there is no open issue, it records the result in the workflow log and creates no issue.

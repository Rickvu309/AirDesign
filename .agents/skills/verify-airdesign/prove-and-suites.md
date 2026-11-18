# Prove and suites

## What `pnpm prove` runs

`pnpm prove` is `$V prove`. It reads the branch's diff against the merge base with `origin/main` (`--base <ref>` for another) and plans one step per kind of change. `--plan` prints that plan as JSON and runs nothing; `--only unit-tests,model-check` runs only those steps.

| Changed                                                                                                                                                                  | Step                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a `.ts`, `.tsx` or `.mjs` under `apps/*/src`, `packages/*/src`, `tests/` or this skill                                                                                   | `unit-tests`: the test files `vitest list --changed <base>` reaches, run by name. 40 files or fewer run in the small lane                                                                                                                 |
| `vitest.config.mts`, a `package.json`, `pnpm-lock.yaml`, `scripts/test-isolation.mjs`, a `.json` or `.sql` under `apps`, `packages` or `tests`, `scripts/pptx-fixtures/` | `unit-tests`: every unit test, because a test reads these outside the import graph                                                                                                                                                        |
| `scripts/*.mjs`                                                                                                                                                          | `script-tests`: each `scripts/*.test.mjs` that imports the changed file, directly or through another script                                                                                                                               |
| code a spec's `covers.json` names, moved since the base (`spec-sync --since`), or a file under `specs/<topic>/`                                                          | `model-check`: `pnpm check:specs <topics>`, then the replay tests `scripts/spec-replays.mjs` finds for them                                                                                                                               |
| a `tests/browser/*.spec.ts`, or a helper there (then every spec importing it)                                                                                            | `browser-tests`: `pnpm test:browser <specs> --repeat-each=5 --workers=1` inside `systemd-run --user --scope -p CPUQuota=200%`. More than 6 specs run once each. Inside the quota Node sees 2 cores, so the worker guard allows one worker |
| `apps/web/src` and no browser spec                                                                                                                                       | a note: write the failing spec first                                                                                                                                                                                                      |
| `apps/web/src/<area>/`, a file at the top of `apps/web/src`, `apps/web/src/components/`, `packages/render/`, or `look/states/<name>.mjs`                                 | `look`: launch one stack, `$V sheet <run> --only <states>` on the states whose design screen that area registers (the editor's for the shared paint), stop it                                                                             |
| what `ci`'s `pptx` job watches                                                                                                                                           | `pptx`: listed, and run only with `--pptx`, since it takes 1 to 2 minutes and about 740 MB per LibreOffice process                                                                                                                        |
| a source under `packages/render/` or `apps/web/src/editor/`                                                                                                              | `bench`: prints `bench suggested: pnpm prove --bench`, and runs `$V bench` against the merge base only with `--bench`, since it takes 6 to 9 minutes. See [bench.md](bench.md)                                                            |

`look` picks states by area, not by imports. The editor is one page: `thin-deck.tsx` imports every Grid, agent panel and design panel file, and which of them shows is decided while it runs, so a Grid change can reach every editor state. A design screen's imports are no guide either: the Grid default screen draws a stand-in and does not import `editor-grid.tsx`. The area rule misses some changes: `packages/theme`, `copy/`, `lib/` and `design/` plan no `look`, and `components/`, `packages/render` and `index.css` plan only the editor's states, though the deck list and settings use them too. The `it.fails` tests in `prove.test.mjs` hold these.

Each step takes the machine lock in its lane, and steps next to each other in the same lane share one hold: `unit-tests` up to 40 files, `script-tests` and `model-check` take the small lane beside a full check, niced on two workers; `unit-tests` beyond that, `browser-tests`, `look`, `pptx` and `bench` take the full lane. The output names each step, its lane, how long it waited, the result and the seconds. `proof.md` under `~/tmp/verify-airdesign/prove-<time>/` has the same rows with the load before and after, what did not run and why, the suites `ci` also runs, and the command that reruns a failure alone. Each step's output is in `<step>.log` beside it.

## Which suites ci runs

`ci` runs these suites on GitHub before the merge, and a push needs only `pnpm gate`. A change that passes only its own new spec can still break others, and ci finds that. To see a suite's answer before ci's, run it here:

| Changed paths                                                                   | Suites                                       |
| ------------------------------------------------------------------------------- | -------------------------------------------- |
| anything                                                                        | `pnpm check`                                 |
| `apps/web`, a package `apps/web` imports, `tests/browser`, this skill's `look/` | the whole browser suite, `pnpm test:browser` |
| `apps/web`, `apps/api`, any package they import, `tests/journeys`, this skill   | every journey, `pnpm test:journeys`          |
| what `ci`'s `pptx` job watches (`packages/pptx`, `apps/web`, ...)               | `pnpm check:pptx`                            |

`pnpm check:pptx` finds the .NET 8 SDK itself: `PPTX_DOTNET`, then `dotnet` on PATH, then `$DOTNET_ROOT/dotnet`, then `~/.dotnet/dotnet`. It adds Chromium's library folder itself too. Set nothing; when no SDK is found it lists the places it tried.

One command reads the branch's changes against `origin/main` and does it:

```sh
$V suites            # which suites this branch needs, and why
$V suites --run      # run them in order under the machine lock, with Chromium's libraries set
$V suites --run browser-tests -- tests/browser/home.spec.ts:12   # one suite, one test
```

`--run` writes `suites.md` under `~/tmp/verify-airdesign/suites-<time>/` with each suite's result, time and the load it ran under. When a suite fails it lists the failed tests and prints the command that reruns only them; run it before you call a failure real. The rules read `apps/web` and `apps/api`'s workspace dependencies and `ci.yml`, so they follow the repo.

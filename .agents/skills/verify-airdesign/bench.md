# Bench

`$V bench` compares the editor's speed on the merge base with `origin/main` and on this checkout, on the cases a person feels. It says `slower` only when the difference is bigger than the noise.

```sh
$V bench                                   # default cases, 7 runs a side, base = merge base with origin/main
$V bench --cases doom-type-40,doom-drag-40 --runs 5    # some cases
$V bench --cases all                       # every case
$V bench --keep                            # keep both stacks; the next try takes --before-run and --after-run
```

`--base <ref>` benches against another commit. `--out <dir>` picks the report folder. Without `--keep`, every stack and scratch tree it started is gone when it ends, however it ends. With `--keep`, it prints the command that stops each kept run: the base run belongs to its scratch tree, so `stop` takes `VERIFY_AIRDESIGN_REPO=<tree>`.

## Cases

Each case is a file in `bench/` exporting `{ name, setup(kit), measure(kit, prepared) }`. `setup` gets a journey kit on a fresh browser context and signs in; its answer goes to `measure`, which returns milliseconds. CPU throttle 4 (`Emulation.setCPUThrottlingRate`) is on for `measure` only. The viewport is the kit's 1470x923 at scale 2.

Every case runs on a 40-slide deck the case builds through `doomRoutes.edit`: a new deck at `/s`, 39 added slides, and the board deck's text, shapes, grids and charts (`boardDeckChanges` in `packages/doom/src/testing/board-deck.ts`) on every five slides (`openBoardDeck` in `bench/doom-deck.mjs`). The editor then sits on slide 2.

| case                 | measures                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doom-open-40`       | reopening the deck: `page.goto("/s/<id>")` to `[data-editor-ready="<id>"]` and a painted layer (`[data-node]`) in every slide list cell in view (`[data-slide-thumb]`)           |
| `doom-drag-40`       | main-thread task time per pointer move (`Performance.getMetrics` `TaskDuration`) while the slide's first layer is dragged in 60 moves                                            |
| `doom-type-40`       | typing in the slide's first text layer: for each of nine letters, the keydown's time to the first frame after the letter shows in `[data-text-editor]`; the answer is the median |
| `doom-add-slide-40`  | the pointerdown on `Add slide` to the first frame after the slide list holds one more `[data-slide-entry]`                                                                       |
| `doom-agent-edit-40` | an agent's box write sent through `doomRoutes.edit` to the first frame after the open tab moved that layer                                                                       |
| `doom-idle-40`       | main-thread task time over 4 s with a layer selected and nudged, and no input                                                                                                    |

`doom-type-40` and `doom-add-slide-40` time the frame after the change lands in the page, because the Event Timing API drops events shorter than 16 ms.

## Runs

- Two stacks start once, through the same launch as `before-after`: the merge base in a scratch worktree, and this checkout.
- Runs interleave main, branch, main, branch for each case, so machine drift falls on both sides. Each run gets a fresh browser context and its own account.
- The bench takes the `full` lane of the machine lock (job `bench`) for its whole length, because a parallel check moves timings. It records the load before and after each run and counts the runs taken above the core count. Those runs are kept, and the report says how many.
- The default set is every case.

## Verdict

A case is `slower` when `median(branch) - median(main)` is more than both interquartile ranges and more than 5 % of `median(main)`, and `faster` under the mirror rule. Anything else is `no difference shown`, not "no difference": with 7 runs a side a slowdown smaller than the noise cannot be told apart. The bench exits 1 only on a slower case.

## Output

```
bench 2c036f24 (main) vs 1a2b3c4d, CPU throttle 4, 7 runs a side, interleaved
case          main median [IQR]    branch median [IQR]  verdict
doom-type-40  18.3 ms [18.1-18.8]  21.4 ms [21.2-22.1]  slower by 3.1 ms (17 %)
doom-drag-40  1.69 ms [1.68-1.71]  1.68 ms [1.67-1.70]  no difference shown
load max 27.1 on 16 cores (2 runs above the core count)
```

The table goes to stderr and to `~/tmp/verify-airdesign/bench-<time>/bench.md`; `bench.json` beside it keeps every run's milliseconds, the medians, p95 across runs and spreads (`[p25, p75]`), the verdicts and the load. Each case's row is also appended to `~/.cache/airdesign/bench.jsonl`, so a case can be followed across PRs.

## When it runs

By hand, and from `pnpm prove --bench`. `pnpm prove` prints `bench suggested: pnpm prove --bench` when a source under `packages/render/` or `apps/web/src/editor/` changed. It never runs on a schedule or in GitHub CI, where a shared runner's CPU makes a throttled timing noise. A PR that touches the editor's gestures puts the bench table in its `## Proof`.

`bin/bench.mjs` runs the bench, `bin/bench-verdict.mjs` holds the verdict rule and the table, and `bench/*.mjs` are the cases.

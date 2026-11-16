# Bench

`$V bench` compares the editor's speed on the merge base with `origin/main` and on this checkout, on the cases a person feels. It says `slower` only when the difference is bigger than the noise.

```sh
$V bench                                   # default cases, 7 runs a side, base = merge base with origin/main
$V bench --cases add-text,drag --runs 5    # some cases
$V bench --cases all                       # every case, with all 20 judged decks imported; by hand only
$V bench --keep                            # keep both stacks; the next try takes --before-run and --after-run
```

`--base <ref>` benches against another commit. `--out <dir>` picks the report folder.

## Cases

Each case is a file in `bench/` exporting `{ name, setup(kit), measure(kit, prepared) }`. `setup` gets a journey kit on a fresh browser context and signs in; its answer goes to `measure`, which returns milliseconds. CPU throttle 4 (`Emulation.setCPUThrottlingRate`) is on for `measure` only. The viewport is the kit's 1470x923 at scale 2.

| case            | measures                                                                                                                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add-text`      | the click on `Add text box` to the first typed letter painted: the click event's time to the first frame after the letter shows in the new text box. The letter is typed straight after the click, the way a person types at once                                          |
| `drag`          | the 95th percentile of frame time, from `requestAnimationFrame`, while the `clean.pptx` text box is dragged 300 px in 30 moves                                                                                                                                             |
| `open-41`       | reopening the imported `doe-heat-pumps.pptx` (41 slides): `page.goto("/deck/<id>")` to `.thin-page[data-deck-ready]` and a painted thumbnail (`[data-thumb-paint]`) in every slide list cell in view. Cells out of view paint when scrolled to, so they are not waited for |
| `import-<deck>` | the file input on Home to the same painted state. The default set imports the largest (`doe-heat-pumps`, 41 slides), a middle (`nasa-cots-parts-nesc`, 17) and the smallest (`nasa-8ft-tunnel`, 4) judged deck                                                             |

The Event Timing API drops events shorter than 16 ms, so `add-text` times the frame after the letter lands in the page instead.

## Runs

- Two stacks start once, through the same launch as `before-after`: the merge base in a scratch worktree, and this checkout.
- Runs interleave main, branch, main, branch for each case, so machine drift falls on both sides. Each run gets a fresh browser context and its own account.
- The bench takes the `full` lane of the machine lock (job `bench`) for its whole length, because a parallel check moves timings. It records the load before and after each run and counts the runs taken above the core count. Those runs are kept, and the report says how many.
- The default set at 7 runs a side takes about 6 to 9 minutes.

## Verdict

A case is `slower` when `median(branch) - median(main)` is more than both interquartile ranges and more than 5 % of `median(main)`, and `faster` under the mirror rule. Anything else is `no difference shown`, not "no difference": with 7 runs a side a slowdown smaller than the noise cannot be told apart. The bench exits 1 only on a slower case.

## Output

```
bench 2c036f24 (main) vs 1a2b3c4d, CPU throttle 4, 7 runs a side, interleaved
case       main median [IQR]    branch median [IQR]  verdict
add-text   183 ms [181-188]     214 ms [212-221]     slower by 31 ms (17 %)
drag       16.9 ms [16.8-17.1]  16.8 ms [16.7-17.0]  no difference shown
load max 27.1 on 16 cores (2 runs above the core count)
```

The table goes to stderr and to `~/tmp/verify-airdesign/bench-<time>/bench.md`; `bench.json` beside it keeps every run's milliseconds, the medians and spreads (`[p25, p75]`), the verdicts and the load. Each case's row is also appended to `~/.cache/airdesign/bench.jsonl`, so a case can be followed across PRs.

## When it runs

By hand, and from `pnpm prove --bench`. `pnpm prove` prints `bench suggested: pnpm prove --bench` when a source under `packages/render/` or `apps/web/src/editor/` changed. It never runs on a schedule or in GitHub CI, where a shared runner's CPU makes a throttled timing noise. A PR that touches the editor's gestures puts the bench table in its `## Proof`.

`bin/bench.mjs` runs the bench, `bin/bench-verdict.mjs` holds the verdict rule and the table, and `bench/*.mjs` are the cases.

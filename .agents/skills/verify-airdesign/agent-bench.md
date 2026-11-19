# Agent bench

`$V agent-bench` asks Aira, the shipped path (the browser loop, the server's model proxy and the same `/mcp` tools and limits an outside agent gets), to do deck tasks, and scores each trial with mechanical rules. No model judges a trial.

It calls the real model with the owner's key, so a person or an agent runs it by hand. No check, `prove`, `ci` job or test runs it. Its own test, the `agent-bench-recorded` journey, plays recorded streams.

```sh
$V agent-bench run --model-key-env ANTHROPIC_API_KEY                         # every task, 3 trials, Sonnet 5.5 at low
$V agent-bench run --model-key-env ANTHROPIC_API_KEY --tasks 'overflow-*' --trials 5 --effort medium
$V agent-bench compare <run-dir> [<run-dir or published name>]               # second defaults to the newest published run with the same tasks
$V agent-bench publish <run-dir>                                             # summary.json to the bench release
```

`run` launches its own stack with `launch --model-key-env NAME [--model m] [--effort e]` and stops it after; `--run <run>` uses one already launched that way, and `--keep` keeps the stack. The key is read from the variable named on the command line and is never printed, logged or written. The validator needs the .NET 8 SDK, as `check:pptx` does.

## Tasks

`bench/agent-tasks.json` holds the tasks. Each has `id`, `family`, `deck` (a file in `scripts/pptx-fixtures` or its `corpus`), `prompt` (what a person types to Aira), `may` (`{ slides: [n...] | "any" | "new" }`, the slides it may change), `want` (the rules below) and `limit` (`{ calls, seconds }`). `bin/agent-bench.test.mjs` checks the file. Its sha256 is the run's `tasks`, and `compare` refuses two runs whose tasks differ, naming each changed task.

| want                                  | holds when                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `slides-added` `count`                | the export has exactly `count` more slides, each with a written title placeholder                        |
| `finding-gone` `slide` `code`         | the original had that fault on that slide, the export has none, and no new fault appeared on the slide   |
| `no-new-findings`                     | no `(slide, node, code)` fault in the export that the original lacked                                    |
| `text-kept` `slides`                  | every paragraph and table cell of those original slides appears in the export's same slide               |
| `text-has` `slide` `text`             | the export's slide text carries `text`                                                                   |
| `text-changed` `slides` `lengthRatio` | each slide's text changed and its length over the original's is inside the range                         |
| `script` `slides` `script`            | at least 30 % of the words on those slides carry `Latin-vi` diacritics, `Cyrillic` or `Japanese` letters |
| `joined` `slide` `shapes`             | at least `shapes` shapes are bound by `p:cxnSp` connectors on that slide                                 |
| `theme-colors` `slides`               | no `a:srgbClr` is left in those slides' parts                                                            |

## Scoring

Each trial signs in a fresh account, imports the deck, waits until the server holds its whole index (so no call is refused for indexing and counted twice), types the prompt into Ask Aira, waits until the run stops (no Stop button and no open turn or tool call for 1 s) or its time runs out (then it presses Stop), and exports through the Export button.

1. Faults: `resolvedSlide` from `tests/browser/resolved-paint.mts` resolves both decks' slides, as `fixture-slides.mts` does, `slideWidths` measures the fonts in the trial's page, and `slideFindings` lists faults (notes do not count).
2. Untouched: `deckDiff` of original and export. A part outside `may` (the slide's part and its rels; for `"new"` added parts and the deck's list of slides) names the trial failed.
3. Validator: the pptx-judge validator on both files, judged by `judgeParts` as `check:pptx` does.
4. Calls: `tools/call` requests from the page, with refusals by kind. The browser loop's own closing `stop_run` counts.
5. Tokens: input, cache read, cache write and output of every model call, which the stack writes to `aira-counts.jsonl`.
6. Time: from the prompt sent to the run's stop.

A trial passes when every want holds, untouched and the validator are clean, and it stayed inside `limit` without being stopped.

## Output

`~/tmp/verify-airdesign/agent-bench-<time>/` holds `results.jsonl` (one line per trial), `summary.json` (per task: pass share, median calls, tokens and seconds), `summary.md`, and the export of each failed trial. `publish` puts `summary.json` on the GitHub release `bench` as `agent-bench-<commit>-<model>-<effort>-<date>-<hash>.json`. Nothing goes in the repo or `metrics.json`.

## Compare

`compare` pairs runs by task: each task's pass share under the second run minus under the first, bootstrapped over tasks (10,000 resamples) for a 95 % interval. It says a run passes more only when the interval leaves out 0, and `not shown` otherwise. Tokens, calls and seconds use each task's median, the paired log ratio and the same bootstrap.

With 30 tasks and 3 trials a side, a pass-rate difference under about 14 points is not believable. Raise `--trials` to 5 before adding tasks to see smaller effects.

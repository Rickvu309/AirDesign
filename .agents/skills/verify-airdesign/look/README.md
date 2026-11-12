# Look

`look`, `compare`, `sheet` and `states` are commands of `bin/verify-airdesign.mjs`. Each prints one JSON line with counts and absolute paths, or a message and exit 1. They use the repo's Playwright Chromium and `pngjs`, no paid model and no key.

Every capture is the design's frame: 1470 by 923 CSS px, device scale 2, fonts and images loaded, reduced motion.

## look

`look <run> <state-or-path>` writes, under the run's evidence dir:

- `page.png`, the page as it is.
- `annotated.png`, each finding boxed and numbered: red rank 1, orange rank 2, blue rank 3.
- `NN-<detector>.png`, a crop around finding NN.
- `findings.json`, ranked. A finding names its detector, rank, selector, box in CSS px, message and crop. `more` and `also` count and name alike findings on the same page.

Rank 1: a person loses content or a control. Rank 2: readability or layout. Rank 3: a hint.

A path signs in a fresh account. `--import deck.pptx [--slide n]` opens a file through Home first, the way a person does. `--cookie name=value` uses an account you already have.

## compare

`compare <run> <state-or-path> [design-screen]` puts the design screen beside the real page. The design screen defaults to the state's own. It may be a URL, so an old build can be put beside today's design.

- `compare.png`: design left, real right, at design size. Each shared region is outlined: green within 1 px and same style, orange changed, red on one side only. The middle strip marks the rows a difference spans.
- `NN-<region>.png`: the design crop beside the real crop for each difference, at scale 2.
- `compare.json`: for each region the box delta in px and each style that differs.

Regions are the `data-*` handles both sides share, listed in `compare.mjs`. The style list is fixed: font family, size, weight, line height, letter spacing, color, background, border, radius, padding, gap, shadow and opacity. A region that holds content, such as a slide or a slide card, compares only its frame. Sample content differs, so `compare` never judges slide content, words, counts or pixels. A region with no handle cannot be compared: add the same `data-` attribute to the design screen and the real component.

## states and sheet

`states.mjs` is the one list of named states of the real app. A state names its design screen, if one exists, and how to reach it: a journey and the label of one of its captures, or a small driver built on the journey kit. `sheet` walks each journey once for all of its states, so a journey's later states cost little.

`sheet <run> [--only 'agent-*']` drives every state, runs `look`, and runs `compare` where a design exists. It writes `sheet.html` for a person, `sheet-00.png` as the summary and then one PNG page per state, and `sheet.json` with every finding ranked. A full sheet also names any allow entry that silenced nothing.

To add a state, add one entry. Reuse a journey's capture when one shows the state.

## before-after and annotate

`callouts.mjs` reads the callouts file and refuses a bad one with the block and callout it means. `placement.mjs` is the rule: each numbered circle goes on the side of its target with the most free room, off every target and every other circle, in the frame's 30 px margin when the crop has no room, at the same spot on both sides; the arrow stops 3 px outside the target. `annotate.mjs` lays each block out as HTML with the `packages/theme` tokens and Geist, and the browser screenshots it at 850 CSS px and scale 2, a new image every 6000 px. Narrow crops sit side by side, wide ones stack. `before-after.mjs` drives a state on one stack and measures the selectors. A side runs its own `look/states.mjs` when it has the state, and otherwise this one with that side's own journey files.

`publish` adds the PNGs to the `archive/proof` branch with git plumbing (a temporary index, `commit-tree`, `push <sha>:refs/heads/archive/proof`), retrying when another publisher moved the branch first. Links are pinned to the commit, so a later publish never changes an old PR's pictures. The repo is private, so only signed-in readers of the repo can load them. The pre-push check lets a commit through to that branch only when every file in it is a PNG. No workflow runs on a push to it, and the `closed-branch` workflow leaves `archive/` branches alone.

## Detectors

`detectors.mjs` is the table. Each detector is one module in `detectors/` that runs in the page on one element at a time, with the kit in `page-kit.mjs`. Each has a fixture where it must fire and a near miss where it must not, in `tests/browser/design-detectors.spec.ts`.

| Detector            | Rank | Catches                                                                                     | Cannot judge                                                                                                                     |
| ------------------- | ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| overflowing-text    | 1    | text cut by a clipping container, painted under a later element, or painted over other text | text in a canvas or image; covers that ignore the pointer; text past a slide's own edge, which is off the slide as in PowerPoint |
| invisible-control   | 1    | a focusable or editable element that paints nothing                                         | whether a painted control is understandable                                                                                      |
| internal-identifier | 1    | snake_case, SCREAMING_CASE, `a::b` and catalog tool names a person can read                 | an internal word that reads as English, such as a one-word refusal code                                                          |
| empty-region        | 1    | a landmark or panel over 12% of the screen with almost nothing in it                        | whether blank space serves the design; slides, the canvas and the filmstrip are meant to leave room                              |
| truncated-text      | 2    | text cut by an ellipsis, a line clamp or its own hidden overflow                            | whether the cut was meant                                                                                                        |
| stacked-frames      | 2    | a border, outline or ring 2 to 8 px inside another that fills half of it                    | whether two frames were meant                                                                                                    |
| text-contrast       | 2    | text below WCAG AA against the solid layers painted under it                                | text over an image, gradient, canvas, filter or translucent layer; text on slides                                                |
| focus-visible       | 2    | a control in the tab order with keyboard focus and no outline, ring or focus rule           | focus states the page was not put in                                                                                             |
| dead-control        | 2    | an enabled button or link with no href, form, onclick or React handler                      | listeners added with `addEventListener`; a finding is a candidate to click                                                       |
| off-token           | 3    | chrome color, size, radius or spacing that is not a `packages/theme` value                  | whether the exception was meant; only with `--off-token`                                                                         |

Nothing here judges taste, hierarchy, whether words are true for their situation, or whether a flow makes sense. A failed deck list that says "Unable to finish this run" passes every detector.

## Allow

Only `allow.json` silences a finding. An entry is `{ "page", "detector", "selector", "reason" }`. `page` is a state name or a `/screens/` path, and `*` matches any run of characters. The entry silences its detector on matching pages, on the element its selector matches and everything inside it. Every entry needs a reason. An entry that silences nothing in a full sweep fails `design-findings`, so remove it when its finding goes.

A real fault is not allowed. It stays a finding, and when you do not fix it, it gets a `test.fail` in `tests/browser/design-states.spec.ts`.

## The check

`tests/browser/every-screen.spec.ts` scans every `/screens/` page it already opens. `tests/browser/design-states.spec.ts` launches one stack and sweeps every state. The `design-findings` step (`scripts/design-findings.mjs`) adds both counts, lists every finding, and warns when the total differs from `metrics.json`, an allow entry silences nothing, or a state was not reached.

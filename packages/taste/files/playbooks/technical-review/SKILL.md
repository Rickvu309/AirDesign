---
name: technical-review
description: "Read when the deck explains a system, an architecture, a design choice or an engineering plan to engineers, even one that asks for a go or no-go."
---

# Technical review

The readers build things. They want the mechanism, the trade-off chosen and the evidence behind it, stated precisely, because a misread here costs weeks.

Work freely. At each pause point, stop and confirm every item. Fix what fails before you go on.

## Read on these triggers

- Read alone in order, the titles fail to tell the design: `principles/headlines`.
- A re-added total or a recomputed figure disagrees with the material, or a title claims a cause: `principles/number-truth`.
- The components, options or risks will not fall into three of equal rank: `principles/one-two-three`.
- The deck proposes work with several owners and milestones: `principles/strategy-5w1h`.

## Pieces that fit this job

Options, chosen by what the slide must explain. Copy them from `kit`; each recipe is a script you run.

- A system's parts and how they connect: `diagrams/architecture`.
- Steps in order, a request path, a pipeline: `diagrams/process-flow`.
- Options against criteria: `charts/table`, the chosen row marked, or `kit/comparison` for two or three.
- A canary, rollout or experiment: `charts/line`, the changed group in the accent against the unchanged baseline in gray, the change marked.
- A measurement over versions or time: `charts/line` or `charts/column`. Ranked costs or latencies: `charts/bar`.
- Labels that tie a diagram to its explanation: `kit/numbered-callout`.
- Milestones: `kit/timeline-step`. Sources and benchmark setups: `kit/source-line`.

## Pause 1: Setup

- [ ] The session type is stated: inform, decide, or solve a problem together.
- [ ] Jargon stays only where every reader shares it; any other term is defined once where it first appears.
- [ ] An unfamiliar system is shown as its parts before any conclusion about it.
- [ ] The plan is 5 to 8 slides with the cover, with no appendix, divider or recap slide unless the person asked. Each ask or finding keeps the slide with its evidence.

## Pause 2: Content

- [ ] Each component says what it does, how, and why it exists.
- [ ] Principles and trade-offs come before tactical detail; detail goes in a table on the slide that needs it, or is left out.
- [ ] Judgment calls, assumptions, dependencies and risks each have a slide or a row.
- [ ] A comparison of three or more options on three or more criteria is a table.
- [ ] No sentence runs past two clauses; nuance goes into points or table rows.
- [ ] Every total is re-added from its parts, and every percentage and difference recomputed, before it goes on a slide. Where the material's own figure disagrees, the slide shows the recomputed one, and the gap, both figures named, sits under the exhibit it changes.

## Pause 3: Headlines

- [ ] Each title is one sentence of 12 words or fewer, two lines at most.
- [ ] Each title asserts the choice made or the finding: "A queue between ingest and render keeps p99 under 200 ms".
- [ ] Precision wins over punch: units, versions and conditions are named.
- [ ] Read alone, the titles go: problem, constraints, design, evidence, plan.
- [ ] Every number, date and name in a title matches the material exactly (4.8 ms stays 4.8 ms) or, for a total you re-added, your figure with the material's named on the slide, and a date or deadline appears only when the material gives it or one step of arithmetic on it does.
- [ ] The last slide is the decision asked for or the plan, with owners and dates.

## Pause 4: Visuals

- [ ] Diagrams run left to right or top to bottom, the path under discussion in the accent and the rest in neutral.
- [ ] Every arrow is attached to its boxes, and every box name matches the words in the body.
- [ ] A canary or experiment result is a `charts/line` with the change marked, never a table of the same numbers.
- [ ] Tables carry horizontal rules only, numbers right-aligned.
- [ ] Every measurement names its setup and its source.

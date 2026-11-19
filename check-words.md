# Check words

The words for how a change is checked, measured, proven and named. Use one word per idea: the bold term, never its Avoid terms.

## What runs

**check**:
A mechanical rule that passes or fails without a person or paid model.
_Avoid_: guard, validation

**gate**:
The run `pnpm gate` stamps for a push. It runs cheap checks, builds, and unit and script tests selected by the diff.
_Avoid_: pre-push check, quick check, fast check

**step**:
One thing `pnpm check` or ci runs, with a name and a command. Every step has one kind.
_Avoid_: task, job, stage

**rule**:
A check on what the files say. It needs nothing built and nothing running.

**tests**:
A suite of tests that runs code.

**build**:
Work whose output other steps need.

**report**:
Work that prints or lists something and judges nothing.

**part**:
The steps ci runs on one machine, such as `source` or `scripts`.
_Avoid_: shard, job, matrix

**ci**:
The result a pull request needs to merge. Every part must pass.
_Avoid_: pipeline

**owner**:
The repository owner, who reads what the checks list.
_Avoid_: the organization's name, admin, maintainer

**journey**:
A script that walks through the real app as a user does.
_Avoid_: end-to-end test, scenario, flow

## What a check says

**block**:
To fail the run when the step fails.
_Avoid_: hard fail, enforce

**warn**:
To print a step failure and let the run pass.
_Avoid_: soft fail, advisory, non-blocking

**false stop**:
A failed run on a pull request that merged with the same content.
_Avoid_: flake, spurious failure

**red main**:
The state of `main` when ci fails on a commit already there.
_Avoid_: broken build, broken main

## What we measure

**metric**:
A number `pnpm check` prints to track progress.
_Avoid_: stick, score, KPI

**goal**:
The value a counted metric should reach.
_Avoid_: target, threshold

**limit**:
The most seconds a timed step may take.
_Avoid_: budget, ceiling, threshold

**frame time**:
The milliseconds from one painted frame to the next. At 60 frames a second it is 16.7.
_Avoid_: fps, frame rate

**input to paint**:
The milliseconds from a pointer event to the end of the frame that shows it.
_Avoid_: input lag, latency

**known failure**:
A test that is skipped, marked to do, expected to fail, or asserts nothing.
_Avoid_: known fault, known bug, disabled test

**the bar**:
Every goal, every limit, and every PowerPoint case and deck that is already judged.
_Avoid_: quality bar, standard, baseline

**lowers the bar**:
A pull request lowers the bar when it raises a limit, moves a goal, moves a metric away from its goal, removes a metric, check step, job, spec invariant, case, deck or caught break, skips a test, makes a check step a warning or local, or turns down a lint or type rule.
_Avoid_: regresses, weakens, loosens

**changes ci**:
An edit to a file that decides which checks run or how they judge: a workflow, a check step or check script, test selection, the gate, or lint and type config. Tests, cases, fixtures, specs and docs alone do not change ci.
_Avoid_: touches infra, tooling change

**countersign**:
A comment `countersign <head> right: <reason>` on a pull request that lowers the bar, from an agent that did not write it and judged only its diff and the bar's list. The `bar` check fails until one names the current head.
_Avoid_: approval, sign-off, review

## How a change is shown to work

**proof**:
The commands a builder ran for a change and what they printed.
_Avoid_: evidence, verification, validation

**judge**:
To compare an exported PowerPoint file with its original and report every difference no edit asked for.
_Avoid_: validate, verify

**diff**:
The parts an exported PowerPoint file changed, added or removed against its original, with each changed XML line and its shape path. It gives no verdict; `--allow` names the parts an edit may change.
_Avoid_: delta, comparison

**slide-diff**:
The score of a painted slide against its reference image: the mean similarity, the lowest similarity of any 32 by 32 pixel tile, and the share of pixels that changed. The lowest tile catches one missing element on a mostly white slide.
_Avoid_: image diff, visual diff, screenshot comparison

**fidelity reference**:
A picture PowerPoint itself drew of a slide: a page of the PDF PowerPoint saved of a deck, or the thumbnail of slide 1 PowerPoint keeps in a deck. paint-fidelity scores our painted slides against them.
_Avoid_: golden image, ground truth

**planted fault**:
A break put into code on purpose, to see whether a check catches it.
_Avoid_: mutant, planted break, injected bug

## How a pull request is named

**title**:
A pull request or commit's first line. Use an imperative verb and one outcome in at most 72 characters, with no full stop.
_Avoid_: subject, headline, summary line

**area**:
The part of AirDesign a pull request touches, named by a label the `bar` check adds from the changed paths in `scripts/areas.json`: `editor`, `aira`, `deck-home`, `sign-in`, `pptx`, `document`, `verify`, `specs` and `tooling`. A pull request may have several.
_Avoid_: component, scope, module

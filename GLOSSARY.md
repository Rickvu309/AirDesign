# AirDesign

The words this repo uses for how a change is checked and merged. One word per idea: use the word in bold, and none of the words under Avoid.

## Language

### What runs

**check**:
One mechanical rule that passes or fails with no person and no paid model.
_Avoid_: guard, gate, validation

**step**:
One check as `pnpm check` or CI runs it, with a name and a command.
_Avoid_: task, job, stage

**part**:
A group of steps that CI runs on its own machine, beside the other parts.
_Avoid_: shard, job, matrix

**ci**:
The one result a pull request needs to merge. It passes when every part passes.
_Avoid_: gate, pipeline, build

**owner**:
The person who owns this repository and reads what the checks list.
_Avoid_: the organization's name, admin, maintainer

**journey**:
A scripted walk through the real app, done the way a user does it.
_Avoid_: end-to-end test, scenario, flow

### What a check says

**block**:
A step blocks when its failure fails the run.
_Avoid_: hard fail, enforce

**warn**:
A step warns when it prints its failure and the run still passes.
_Avoid_: soft fail, advisory, non-blocking

**false stop**:
A failed run on a pull request that later merged with the same content.
_Avoid_: flake, spurious failure

**red main**:
The state of `main` after ci fails on a commit that is already there.
_Avoid_: broken build, broken main

### What we measure

**metric**:
A number we want moved, printed on every run of `pnpm check`.
_Avoid_: stick, score, KPI

**goal**:
The value a counted metric should reach.
_Avoid_: target, threshold

**limit**:
The most seconds a timed step may take.
_Avoid_: budget, ceiling, threshold

**known failure**:
A test that is skipped, marked to do, expected to fail, or asserts nothing.
_Avoid_: known fault, known bug, disabled test

**the bar**:
Every goal, every limit, and every PowerPoint case and deck that is already judged.
_Avoid_: quality bar, standard, baseline

**lowers the bar**:
A pull request lowers the bar when it moves a metric away from its goal, raises a limit, or changes a judged case or deck.
_Avoid_: regresses, weakens, loosens

**changes ci**:
A pull request changes ci when it edits a file that decides what ci checks.
_Avoid_: touches infra, tooling change

### How a change is shown to work

**proof**:
What a builder shows for a change: the commands it ran and what they printed.
_Avoid_: evidence, verification, validation

**judge**:
To compare an exported PowerPoint file with its original and report every difference no edit asked for.
_Avoid_: validate, verify, diff

**planted fault**:
A break put into code on purpose, to see whether a check catches it.
_Avoid_: mutant, planted break, injected bug

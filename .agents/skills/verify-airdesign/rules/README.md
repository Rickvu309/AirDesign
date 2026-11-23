# Holds: check a rule in any order

Each folder in `specs/<topic>` holds a TLA+ model (`<Module>.tla`), its bounds and checked properties (`<Module>.cfg`), and a reader view (`view.mjs`) that turns a model state and step into words. TLC checks every reachable state of the model. A replay then drives the model's edges through the real functions, so a model that drifts from the code fails a test. A pass covers the model under its bounds and the code the replay drives. It does not cover code outside them.

The coverage record has one entry per check: the properties, the code it covers, the bounds, the command, the replay, the gaps and the known bugs. Each spec's `specs/<topic>/covers.json` names the declarations its model describes, file by file, with a digest of their source at the last sync. [checks-server.md](checks-server.md) holds agents, turn, stop, aira-loop, usage, oauth and owner. [checks-doom.md](checks-doom.md) holds doom, doom-runs and the structure of layers on Doom. [checks-credits.md](checks-credits.md) holds paid usage resets and credit history. Read the entry for every check your change touches before you trust a pass.

## 1. Find the checks your change touches

```sh
node scripts/spec-sync.mjs                     # every spec whose covered declarations moved since its sync
node scripts/spec-sync.mjs --since origin/main # the specs whose covered declarations this branch moved
```

The first is the `spec-drift` step of `pnpm check`. Each line names the spec, the declarations and the file, and gives the `git diff` of what moved since the sync. A spec it names needs a look. A declaration that no longer exists is named too: rename it in that spec's `covers.json`. A name inside a declaration is covered by naming the declaration that holds it, and `"*"` covers a whole file. Also look for new code that writes the state a check guards, even in a file the entry does not list: a new Doom op that writes a run, a new writer of a deck's edits, a new path that spends a once.

## 2. Run the check

```sh
pnpm check:specs                 # every spec, then each known failure
pnpm check:specs doom stop       # only the named specs
```

Each line says the distinct state count, the verdict and the time. TLC takes 1 to 5 s per spec, mostly JVM start, and about 40 s for the full set. A spec must stay under 500 distinct states. Results are cached by a hash of every `.tla` and `.cfg` file in the folder, so any edit to them reruns TLC, and an unchanged spec answers from the cache. `pnpm check` keeps its cache in `~/.cache/airdesign/spec-results`. To force a fresh run, set `AIRDESIGN_SPEC_CACHE` to an empty folder.

Then find and run the replays:

```sh
node scripts/spec-replays.mjs
pnpm exec vitest run <test-file> # use the path printed for the check
```

For a full pass, run every distinct test file the command prints. One file can replay several specs. This list is the source for the `spec-coverage` step of `pnpm check`, which warns when a spec has no replay and no listed reason.

## 3. Read a result

On a failure, `check:specs` prints TLC's trace and then the counterexample step by step: each step in the words of `view.mjs`, the action name in brackets, and the variables that changed. Read every result with the pstack `/statechart` skill too. It shows an invariant violation as its shortest path in plain words, and on a pass it draws how the system moves between states.

A replay failure names the edge that the code took differently, as `Group: state -Action-> Group: state` in the view's words.

## 4. Judge a failure

Replay the counterexample against the real code, one step at a time, with the functions its entry names.

- A step the code cannot take means the model is wrong. Fix the model from the code, and say what was wrong.
- If every step can happen, it is a bug. Name the commit that introduced it, tell the steps in the code's own words, and say the harm in one sentence. Do not weaken the property or the model until it passes, and do not fix product code in the same change.

Keep a bug you do not fix in two places. In the code, add an `it.fails` test that replays the counterexample against the real functions. In the spec, move the violated property out of `<Module>.cfg` into `<Module>.known.cfg`. `check:specs` then runs the known config and fails only if it stops failing, so the fix forces both to move back.

## 5. Change a spec with the code

Change the model or replay from the code, before you rerun. One indivisible step in the code stays one action in the model. Change a property only for a promise that changed on purpose, with evidence in the commit, the tests or the doc, and write the old and new wording in the PR. Keep the bounds unless the change makes them wrong.

After a pass, break the code the way the property guards against, for example remove a refusal or reorder a step, and see the replay or TLC fail. Then drop the break. A check you have never seen fail proves nothing.

Then update its entry: the covered code, the bounds, the gaps and the replay, and the names in its `covers.json`. Once `pnpm check:specs <topic>` passed and the replay passed, record the sync with `node scripts/spec-sync.mjs --sync <topic>`. It records a source digest and Git blob per covered file and refuses a spec with no passing TLC result. Use the blobs to compare with the last reviewed declarations. Sync only a check whose model you confirmed against the code. Leave one you could not confirm, and say why.

Finish with `pnpm check`. A change to a spec or replay changes what `ci` judges, and the `bar` check may label the PR.

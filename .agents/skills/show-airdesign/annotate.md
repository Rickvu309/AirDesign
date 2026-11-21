# Annotate a screen for a person

An annotated image is evidence for one claim on a `logic` page: the leaf says what changed on screen, and the image shows it. Every command here is `verify-airdesign`'s, run from the repo root:

```sh
V=.agents/skills/verify-airdesign/bin/verify-airdesign.mjs
```

The craft is the same for one screen or a pair. Crop to the thing the note names, keep enough around it to place it, put one true note on each numbered callout, and check a stranger sees the point in ten seconds. [verify-airdesign's look/README.md](../verify-airdesign/look/README.md#before-after-and-annotate) covers targeting, placement and each capture's outcome; [the design review](../verify-airdesign/look/design-review.md) has note examples.

## Before / after in the PR

Every PR that changes what a person sees gets a `## Before / after` section. When nothing looks different, the section holds one line instead, `No visible change: <why>`, and `bar` prints the reason for the owner. `pnpm land` stops, and the `bar` check fails and labels the PR `needs-before-after`, when the section has neither.

1. Write a callouts file, one block per changed state from `$V states`:

   ```json
   [
     {
       "state": "agent-empty",
       "title": "Agent panel, empty",
       "crop": "[data-editor-panel]",
       "callouts": [{ "at": "[data-aira-welcome] h2", "note": "Empty panel names Aira and what to check (was blank)" }]
     }
   ]
   ```

   `crop` and `at` take CSS selectors or boxes in CSS px. `click` lists selectors to click after reaching the state. Set `"target": "element"` for a border or frame; text is the default. Name the measured change in each note. The look README and the design review above cover targeting, detail crops, and note examples.

2. Run `$V before-after callouts.json`. It builds and launches the merge base with `origin/main` in a scratch worktree, launches this checkout, drives each state on both with that side's own journey, and writes `annotated-N.png`, each full screenshot, and `before-after.md`. `--base` and `--head` take other commits. `--keep` keeps both stacks and prints their runs, so the next try takes `--before-run` and `--after-run` and costs seconds. Stop them with `$V stop` when done.
3. Open every `annotated-N.png`. Check each arrow points at the thing its note names on both sides, each note is true, and a stranger sees what changed in ten seconds. A selector missing on one side shows a grey number and says so in the legend; that is right only when the thing is new or gone. A `Failed on main` tag means the base never reached that state: fix that journey or say why before you publish.
4. `$V publish <out-dir> --pr <number>` uploads the PNGs to the first `proof`, `proof-2`, … release with room and writes `before-after.published.md`. Paste it into the PR body as is.

`$V annotate <run> callouts.json` draws the same callouts on one run, for a comment, a bug, or a `logic` leaf.
`$V comment <pr> <markdown-file>` posts a pull request comment prefixed with the agent line `🤖 **AI Agent responding on behalf of Quan Vu**`. Always post PR comments with this command.

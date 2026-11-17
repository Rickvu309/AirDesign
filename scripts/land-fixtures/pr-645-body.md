## What changes

A single edit too large for any request, which a stuck device could not split, was set aside with the notice "The deck changed", the wrong reason. It now says: "Unable to save an edit. It was too large to save, so an export of this deck does not include it."

The set-aside slot marks a row set aside as too large, the flush result counts those as `asideTooLarge`, and `flushPending` answers `set-aside-too-large` when every row set aside was too large. When some were too large and some were refused for another reason, the editor keeps the existing "The deck changed" notice.

## Proof

Failing tests first at each layer that picks the words: `packages/live/src/cache-size.test.ts` (flush reports `asideTooLarge: 1`), `apps/web/src/commit-edit.test.ts` (all, none or some too large), `apps/web/src/editor/use-deck-status.test.ts` (the notice). A browser spec in `tests/browser/large-edits.spec.ts` plants one sealed 1 MB edit, reloads, and sees the new words and not "The deck changed" (passed once, 2 workers).

`pnpm prove` on 5d5bfaa0 and 07b4e33b: unit PASSED 452 tests, specs (device-queue, lost-answer) PASSED, look ran 110 states with 9 findings in states this change does not touch. The 5x browser run of `prove` did not complete: it waited two hours for the check lock at a load average of 143.

## Not done

No `/screens/` page for the new notice yet; `s49-03-editor-errors-edits-set-aside` shows the old words only.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

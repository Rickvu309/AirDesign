# New web code stays on the design system

`apps/web/.oxlintrc.json` runs the fifteen rules of the `outtrue` recommended config over `apps/web/src`. They fail a hardcoded length or color in a class, a `className` that restyles a primitive from `src/components/ui` instead of placing it, a raw `<button>` or `<input>` where a primitive exists, a class reaching inside a primitive, `!important`, a template-literal `className`, and an import that points up the layers `src/lib`, `src/copy`, `src/components/ui`, `src/components`, then the rest of `src`. Each message names the fix.

The code that broke a rule when it arrived is listed in that rule's `baseline`, as a count per file. A file over its count fails, and so does a file under it, so a fix lowers the count in the same commit and the list only shrinks. Never raise a count: the `bar` check lists a raised or added count as lowering the bar. `OPTIONS.md` in the `outtrue` package explains each rule's options.

# What enforces each rule

A rule that a check holds has its own file beside that check, named `<name>.rule.md`: a `# <rule>` line, then what holds it. `pnpm rules` prints them all as one table with each file, and `pnpm rules <word>` prints only the rules that name the word. A new check comes with its own `.rule.md`, so a change never edits a shared list.

This file holds only the rules that review holds: its rows say `review` first. The `rule-rows` step fails a row of a `| Rule | Enforced by |` table, here or in any other file, that a check holds, and names the `.rule.md` to write instead.

| Rule | Enforced by |
| --- | --- |
| Set new rules to `warn` in `scripts/check-steps.mjs` until they catch a real fault with no false stop | review |
| Extend before you build a parallel version, reduced motion shows the finished state | review |
| Copy: `better-writing`, `GLOSSARY.md`, current behavior | review |
| How agents work here | review |

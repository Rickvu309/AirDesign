# What enforces each rule

A rule that a check holds has its own file beside that check, named `<name>.rule.md`: a `# <rule>` line, then what holds it. `pnpm rules` prints them all as one table with each file, and `pnpm rules <word>` prints only the rules that name the word. A new check comes with its own `.rule.md`, so a change never edits a shared list.

This file holds only the rules that review holds: its rows say `review` first. The `rule-rows` step fails a row of a `| Rule | Enforced by |` table, here or in any other file, that a check holds, and names the `.rule.md` to write instead.

| Rule | Enforced by |
| --- | --- |
| Elements with no native PowerPoint form export as pictures; AirDesign looks come first | review; exporter and tests pending |
| An agent's comment or review on a pull request or issue starts with the agent line | review |
| Set new rules to `warn` in `scripts/check-steps.mjs` until they catch a real fault with no false stop | review |
| Extend before you build a parallel version, reduced motion shows the finished state | review |
| Copy: `better-writing`, `GLOSSARY.md`, current behavior | review |
| How agents work here | review |
| The editor marks a deck ready only when it is painted, opened with the server, its fonts and the thumbnails in view are in, and no zoom is settling | review; its tests went with the old editor in 9b0587d26, and a test on the Doom editor is owed |
| A drag leaves the filmstrip and the Design panel alone until it lands | review; its test went with the old editor in 9b0587d26, and a test on the Doom editor is owed |

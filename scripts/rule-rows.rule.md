# A rule a check holds lives in a `.rule.md` beside that check, never as a row of a shared rule table

The `rule-rows` step fails a new row of any `| Rule | Enforced by |` table whose "Enforced by" does not start with `review`, and names the `.rule.md` to write, beside the first file or `pnpm` script the row names (`scripts/rule-rows.test.mjs` replays the rows of d08e3e607 and PR 912). `pnpm rules` prints every rule file as one table

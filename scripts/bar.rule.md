# A PR that lowers the bar is seen by the owner: a raised limit, moved goal, metric off its goal, removed metric, check step, job, spec invariant, case, deck or caught break, new skip, step made a warning or local, lint or type rule turned down

`bar` labels the PR `lowers-the-bar` (`scripts/bar-files.mjs`) and fails until an agent that did not write it countersigns its head (`scripts/countersign.mjs`)

A raised goal is told from a lowered one by the metric's direction, not by a count that sits at its goal: a count that already met its goal may raise it only when the same change meets the new goal, and each count with a goal says `"better": "higher"` or `"lower"` beside it in `metrics.json`, `scripts/metrics.mjs` fails a count that does not, and `bar` reads the direction from there and fails a change of it

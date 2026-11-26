# A PR that lowers the bar is seen by the owner: a raised limit, moved goal, metric off its goal, removed metric, check step, job, spec invariant, browser spec, journey or feature file, new skip, step made a warning or local, lint or type rule turned down

`bar` labels the PR `lowers-the-bar` (`scripts/bar-files.mjs`) and fails until an agent that did not write it countersigns its head (`scripts/countersign.mjs`)

A raised goal is told from a lowered one by the metric's direction, not by a count that sits at its goal: a count that already met its goal may raise it only when the same change meets the new goal.
Each count with a goal says `"better": "higher"` or `"lower"` beside it in `metrics.json`, and `scripts/metrics.mjs` fails a count that does not..
`bar` reads the direction from there and fails a change of it
A removed browser spec, journey or feature file counts because it was the proof of a feature a person uses: Grid view left the product that way, in a dead-code sweep the owner never saw. A rename or a change lowers nothing. The countersign is right only when the feature is still proved elsewhere or the owner asked for the feature to go.

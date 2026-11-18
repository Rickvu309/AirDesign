# Effect graph specimen

`effect-graph.pptx` is a copy of `clean.pptx` with one change: the rectangle's `p:spPr` holds an `a:effectDag` with two `a:outerShdw` children. One is a black shadow down, the other a red shadow to the right. The file is under 100 KB, so the PowerPoint check does not judge it, and it is not in `cases.json` or `corpus.json`.

AirDesign reads any `a:effectDag` as one kept effect graph. It does not edit the graph and it does not show the two shadows as separate rows. The bytes of that graph stay as they are.

Open the file in PowerPoint and look at the rectangle:

- Does the slide paint both shadows?
- After Save, are both `a:outerShdw` elements still in the `a:effectDag`?
- Does Format Shape show both shadows as editable?

Only a person opening the file can answer. Do not build a reader for two outer shadows until that answer is in.

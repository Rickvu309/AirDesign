# Effect graph specimen

`effect-graph.pptx` is a copy of `clean.pptx` with one change: the rectangle's `p:spPr` holds an `a:effectDag` with two `a:outerShdw` children. One is a black shadow down, the other a red shadow to the right. The file is under 100 KB, so the PowerPoint check does not judge it, and it is not in `cases.json` or `corpus.json`.

AirDesign reads any `a:effectDag` as one kept effect graph. It does not edit the graph and it does not show the two shadows as separate rows. The bytes of that graph stay as they are.

Known limit: no one here opens this file in desktop PowerPoint, so how PowerPoint itself paints it, saves it or lists it in Format Shape is not known, and this note makes no claim about it.

A reader for two outer shadows may be built and judged on what can be proved:

- Microsoft's validator accepts the exported file.
- `pnpm check:pptx`, including its LibreOffice render, shows the shadows as the reader says.
- After export, both `a:outerShdw` elements are still in the `a:effectDag`.

# A chart, timeline, flow or matrix fills the band down to the bottom margin, and text tiles stay at content height

`packages/doom/src/agent-band.test.ts` builds a titled slide for a timeline, a flow, a matrix and a lone chart and fails unless each ends on the bottom margin. It builds KPI tiles and cards and fails unless those stay shorter than the margin. `packages/doom/src/agent-patterns.test.ts` builds a word grid and fails unless its rows hug and its gap equals the slide spacing step.

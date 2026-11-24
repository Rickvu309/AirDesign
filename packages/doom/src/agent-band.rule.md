# A chart, timeline, flow or matrix fills the band down to the bottom margin, and text tiles stay at content height

`packages/doom/src/agent-patterns.test.ts` builds a titled slide for a timeline, a flow, a matrix and a lone chart and fails unless each ends on the bottom margin. It builds KPI tiles, cards and a word grid and fails unless those stay shorter than the margin, with the grid's rows hugging and its gap equal to the slide spacing step.

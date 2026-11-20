# Chart

A layer that draws numbers as bars, a line or a pie. Figma Slides has no chart, so its look follows PowerPoint's own defaults and consulting decks.

## Language

**chart value**:
A chart's kind, its categories and its series of numbers, as JSON in the `chart.value` field. The Design panel's Data section edits it, and an agent sends it with `op: add, kind: chart`.
_Avoid_: chart data, chart spec

**embedded workbook**:
The spreadsheet a chart carries inside the PowerPoint file, which PowerPoint's Edit Data opens in Excel. Sheet1 holds the categories down column A and one series per column from B, each series name in row 1. The chart names those cells and keeps a copy of their values, its cache. In a PowerPoint file it is a package part under `ppt/embeddings/`, linked from the chart's `c:externalData`.
_Avoid_: chart sheet, data sheet, linked workbook

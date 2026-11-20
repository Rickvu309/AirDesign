import { trait } from "./trait-decl.js"
import { choice, count, named, record, size } from "./value-kind.js"

export const presetAdjusts = {
  rect: [],
  roundRect: ["adj"],
  ellipse: [],
  triangle: ["adj"],
  rtTriangle: [],
  diamond: [],
  parallelogram: ["adj"],
  trapezoid: ["adj"],
  pentagon: ["hf", "vf"],
  hexagon: ["adj", "vf"],
  octagon: ["adj"],
  homePlate: ["adj"],
  chevron: ["adj"],
  plus: ["adj"],
  frame: ["adj1"],
  corner: ["adj1", "adj2"],
  star4: ["adj"],
  star5: ["adj", "hf", "vf"],
  line: [],
  straightConnector1: [],
  rightArrow: ["adj1", "adj2"],
  leftArrow: ["adj1", "adj2"],
  upArrow: ["adj1", "adj2"],
  downArrow: ["adj1", "adj2"],
  leftRightArrow: ["adj1", "adj2"],
  leftRightArrowCallout: ["adj1", "adj2", "adj3", "adj4"],
  upDownArrow: ["adj1", "adj2"],
  notchedRightArrow: ["adj1", "adj2"],
  round1Rect: ["adj"],
  round2SameRect: ["adj1", "adj2"],
  snip1Rect: ["adj"],
  snip2DiagRect: ["adj1", "adj2"],
  wedgeRectCallout: ["adj1", "adj2"],
  wedgeRoundRectCallout: ["adj1", "adj2", "adj3"],
  pieWedge: [],
  flowChartProcess: [],
  flowChartDecision: [],
  flowChartTerminator: [],
  bracketPair: ["adj"],
  bracePair: ["adj"],
  donut: ["adj"],
  arc: ["adj1", "adj2"],
  can: ["adj"],
  cube: ["adj"],
  rightBrace: ["adj1", "adj2"],
  leftBrace: ["adj1", "adj2"],
  cloud: [],
  flowChartInputOutput: [],
  flowChartManualOperation: [],
  flowChartMerge: [],
  flowChartExtract: [],
  flowChartPreparation: [],
  flowChartManualInput: [],
  flowChartOffpageConnector: [],
  flowChartPunchedCard: [],
} as const satisfies Readonly<Record<string, readonly string[]>>

export type Preset = keyof typeof presetAdjusts

export const presets = Object.keys(presetAdjusts) as [Preset, ...Preset[]]

export const adjustLimit = 8

const guide = count(-2_147_483_647, 2_147_483_647)

export const geometry = trait(
  "whole",
  { version: 1, shape: "bd526818" },
  { shape: record({ preset: choice(presets), adjust: named(guide, adjustLimit) }) },
  { corners: size },
)

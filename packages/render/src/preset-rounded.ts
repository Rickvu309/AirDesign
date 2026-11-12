import type { PresetRule } from "./preset-rule.js"

export const presetRounded: Readonly<Record<string, PresetRule>> = {
  round1Rect: {
    adjusts: ["adj val 16667"],
    guides: ["a pin 0 adj 50000", "dx1 */ ss a 100000", "x1 +- r 0 dx1", "idx */ dx1 29289 100000", "ir +- r 0 idx"],
    paths: [
      {
        data: "M l t L x1 t A dx1 dx1 3cd4 cd4 L r b L l b Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  round2SameRect: {
    adjusts: ["adj1 val 16667", "adj2 val 0"],
    guides: [
      "a1 pin 0 adj1 50000",
      "a2 pin 0 adj2 50000",
      "tx1 */ ss a1 100000",
      "tx2 +- r 0 tx1",
      "bx1 */ ss a2 100000",
      "bx2 +- r 0 bx1",
      "by1 +- b 0 bx1",
      "d +- tx1 0 bx1",
      "tdx */ tx1 29289 100000",
      "bdx */ bx1 29289 100000",
      "il ?: d tdx bdx",
      "ir +- r 0 il",
      "ib +- b 0 bdx",
    ],
    paths: [
      {
        data: "M tx1 t L tx2 t A tx1 tx1 3cd4 cd4 L r by1 A bx1 bx1 0 cd4 L bx1 b A bx1 bx1 cd4 cd4 L l tx1 A tx1 tx1 cd2 cd4 Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  snip1Rect: {
    adjusts: ["adj val 16667"],
    guides: ["a pin 0 adj 50000", "dx1 */ ss a 100000", "x1 +- r 0 dx1", "it */ dx1 1 2", "ir +/ x1 r 2"],
    paths: [
      {
        data: "M l t L x1 t L r dx1 L r b L l b Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  snip2DiagRect: {
    adjusts: ["adj1 val 0", "adj2 val 16667"],
    guides: [
      "a1 pin 0 adj1 50000",
      "a2 pin 0 adj2 50000",
      "lx1 */ ss a1 100000",
      "lx2 +- r 0 lx1",
      "ly1 +- b 0 lx1",
      "rx1 */ ss a2 100000",
      "rx2 +- r 0 rx1",
      "ry1 +- b 0 rx1",
      "d +- lx1 0 rx1",
      "dx ?: d lx1 rx1",
      "il */ dx 1 2",
      "ir +- r 0 il",
      "ib +- b 0 il",
    ],
    paths: [
      {
        data: "M lx1 t L rx2 t L r rx1 L r ly1 L lx2 b L rx1 b L l ry1 L l lx1 Z",
        fill: true,
        stroke: true,
      },
    ],
  },
}

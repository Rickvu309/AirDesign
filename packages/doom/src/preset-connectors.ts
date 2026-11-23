import type { PresetRule } from "./preset-rule.js"

export const presetConnectors: Readonly<Record<string, PresetRule>> = {
  bentConnector2: {
    adjusts: [],
    guides: [],
    paths: [
      {
        data: "M l t L r t L r b",
        fill: false,
        stroke: true,
      },
    ],
  },
  bentConnector3: {
    adjusts: ["adj1 val 50000"],
    guides: ["x1 */ w adj1 100000"],
    paths: [
      {
        data: "M l t L x1 t L x1 b L r b",
        fill: false,
        stroke: true,
      },
    ],
  },
  bentConnector4: {
    adjusts: ["adj1 val 50000", "adj2 val 50000"],
    guides: ["x1 */ w adj1 100000", "x2 +/ x1 r 2", "y2 */ h adj2 100000", "y1 +/ t y2 2"],
    paths: [
      {
        data: "M l t L x1 t L x1 y2 L r y2 L r b",
        fill: false,
        stroke: true,
      },
    ],
  },
  bentConnector5: {
    adjusts: ["adj1 val 50000", "adj2 val 50000", "adj3 val 50000"],
    guides: [
      "x1 */ w adj1 100000",
      "x3 */ w adj3 100000",
      "x2 +/ x1 x3 2",
      "y2 */ h adj2 100000",
      "y1 +/ t y2 2",
      "y3 +/ b y2 2",
    ],
    paths: [
      {
        data: "M l t L x1 t L x1 y2 L x3 y2 L x3 b L r b",
        fill: false,
        stroke: true,
      },
    ],
  },
  curvedConnector2: {
    adjusts: [],
    guides: [],
    paths: [
      {
        data: "M l t C wd2 t r hd2 r b",
        fill: false,
        stroke: true,
      },
    ],
  },
  curvedConnector3: {
    adjusts: ["adj1 val 50000"],
    guides: ["x2 */ w adj1 100000", "x1 +/ l x2 2", "x3 +/ r x2 2", "y3 */ h 3 4"],
    paths: [
      {
        data: "M l t C x1 t x2 hd4 x2 vc C x2 y3 x3 b r b",
        fill: false,
        stroke: true,
      },
    ],
  },
  curvedConnector4: {
    adjusts: ["adj1 val 50000", "adj2 val 50000"],
    guides: [
      "x2 */ w adj1 100000",
      "x1 +/ l x2 2",
      "x3 +/ r x2 2",
      "x4 +/ x2 x3 2",
      "x5 +/ x3 r 2",
      "y4 */ h adj2 100000",
      "y1 +/ t y4 2",
      "y2 +/ t y1 2",
      "y3 +/ y1 y4 2",
      "y5 +/ b y4 2",
    ],
    paths: [
      {
        data: "M l t C x1 t x2 y2 x2 y1 C x2 y3 x4 y4 x3 y4 C x5 y4 r y5 r b",
        fill: false,
        stroke: true,
      },
    ],
  },
  curvedConnector5: {
    adjusts: ["adj1 val 50000", "adj2 val 50000", "adj3 val 50000"],
    guides: [
      "x3 */ w adj1 100000",
      "x6 */ w adj3 100000",
      "x1 +/ x3 x6 2",
      "x2 +/ l x3 2",
      "x4 +/ x3 x1 2",
      "x5 +/ x6 x1 2",
      "x7 +/ x6 r 2",
      "y4 */ h adj2 100000",
      "y1 +/ t y4 2",
      "y2 +/ t y1 2",
      "y3 +/ y1 y4 2",
      "y5 +/ b y4 2",
      "y6 +/ y5 y4 2",
      "y7 +/ y5 b 2",
    ],
    paths: [
      {
        data: "M l t C x2 t x3 y2 x3 y1 C x3 y3 x4 y4 x1 y4 C x5 y4 x6 y6 x6 y5 C x6 y7 x7 b r b",
        fill: false,
        stroke: true,
      },
    ],
  },
}

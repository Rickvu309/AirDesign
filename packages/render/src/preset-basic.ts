import type { PresetRule } from "./preset-rule.js"

export const presetBasic: Readonly<Record<string, PresetRule>> = {
  triangle: {
    adjusts: ["adj val 50000"],
    guides: ["a pin 0 adj 100000", "x1 */ w a 200000", "x2 */ w a 100000", "x3 +- x1 wd2 0"],
    paths: [
      {
        data: "M l b L x2 t L r b Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  rtTriangle: {
    adjusts: [],
    guides: ["it */ h 7 12", "ir */ w 7 12", "ib */ h 11 12"],
    paths: [
      {
        data: "M l b L l t L r b Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  diamond: {
    adjusts: [],
    guides: ["ir */ w 3 4", "ib */ h 3 4"],
    paths: [
      {
        data: "M l vc L hc t L r vc L hc b Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  parallelogram: {
    adjusts: ["adj val 25000"],
    guides: [
      "maxAdj */ 100000 w ss",
      "a pin 0 adj maxAdj",
      "x1 */ ss a 200000",
      "x2 */ ss a 100000",
      "x6 +- r 0 x1",
      "x5 +- r 0 x2",
      "x3 */ x5 1 2",
      "x4 +- r 0 x3",
      "il */ wd2 a maxAdj",
      "q1 */ 5 a maxAdj",
      "q2 +/ 1 q1 12",
      "il */ q2 w 1",
      "it */ q2 h 1",
      "ir +- r 0 il",
      "ib +- b 0 it",
      "q3 */ h hc x2",
      "y1 pin 0 q3 h",
      "y2 +- b 0 y1",
    ],
    paths: [
      {
        data: "M l b L x2 t L r t L x5 b Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  trapezoid: {
    adjusts: ["adj val 25000"],
    guides: [
      "maxAdj */ 50000 w ss",
      "a pin 0 adj maxAdj",
      "x1 */ ss a 200000",
      "x2 */ ss a 100000",
      "x3 +- r 0 x2",
      "x4 +- r 0 x1",
      "il */ wd3 a maxAdj",
      "it */ hd3 a maxAdj",
      "ir +- r 0 il",
    ],
    paths: [
      {
        data: "M l b L x2 t L x3 t L r b Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  pentagon: {
    adjusts: ["hf val 105146", "vf val 110557"],
    guides: [
      "swd2 */ wd2 hf 100000",
      "shd2 */ hd2 vf 100000",
      "svc */ vc  vf 100000",
      "dx1 cos swd2 1080000",
      "dx2 cos swd2 18360000",
      "dy1 sin shd2 1080000",
      "dy2 sin shd2 18360000",
      "x1 +- hc 0 dx1",
      "x2 +- hc 0 dx2",
      "x3 +- hc dx2 0",
      "x4 +- hc dx1 0",
      "y1 +- svc 0 dy1",
      "y2 +- svc 0 dy2",
      "it */ y1 dx2 dx1",
    ],
    paths: [
      {
        data: "M x1 y1 L hc t L x4 y1 L x3 y2 L x2 y2 Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  hexagon: {
    adjusts: ["adj val 25000", "vf val 115470"],
    guides: [
      "maxAdj */ 50000 w ss",
      "a pin 0 adj maxAdj",
      "shd2 */ hd2 vf 100000",
      "x1 */ ss a 100000",
      "x2 +- r 0 x1",
      "dy1 sin shd2 3600000",
      "y1 +- vc 0 dy1",
      "y2 +- vc dy1 0",
      "q1 */ maxAdj -1 2",
      "q2 +- a q1 0",
      "q3 ?: q2 4 2",
      "q4 ?: q2 3 2",
      "q5 ?: q2 q1 0",
      "q6 +/ a q5 q1",
      "q7 */ q6 q4 -1",
      "q8 +- q3 q7 0",
      "il */ w q8 24",
      "it */ h q8 24",
      "ir +- r 0 il",
      "ib +- b 0 it",
    ],
    paths: [
      {
        data: "M l vc L x1 y1 L x2 y1 L r vc L x2 y2 L x1 y2 Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  octagon: {
    adjusts: ["adj val 29289"],
    guides: [
      "a pin 0 adj 50000",
      "x1 */ ss a 100000",
      "x2 +- r 0 x1",
      "y2 +- b 0 x1",
      "il */ x1 1 2",
      "ir +- r 0 il",
      "ib +- b 0 il",
    ],
    paths: [
      {
        data: "M l x1 L x1 t L x2 t L r x1 L r y2 L x2 b L x1 b L l y2 Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  homePlate: {
    adjusts: ["adj val 50000"],
    guides: [
      "maxAdj */ 100000 w ss",
      "a pin 0 adj maxAdj",
      "dx1 */ ss a 100000",
      "x1 +- r 0 dx1",
      "ir +/ x1 r 2",
      "x2 */ x1 1 2",
    ],
    paths: [
      {
        data: "M l t L x1 t L r vc L x1 b L l b Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  chevron: {
    adjusts: ["adj val 50000"],
    guides: [
      "maxAdj */ 100000 w ss",
      "a pin 0 adj maxAdj",
      "x1 */ ss a 100000",
      "x2 +- r 0 x1",
      "x3 */ x2 1 2",
      "dx +- x2 0 x1",
      "il ?: dx x1 l",
      "ir ?: dx x2 r",
    ],
    paths: [
      {
        data: "M l t L x2 t L r vc L x2 b L l b L x1 vc Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  plus: {
    adjusts: ["adj val 25000"],
    guides: [
      "a pin 0 adj 50000",
      "x1 */ ss a 100000",
      "x2 +- r 0 x1",
      "y2 +- b 0 x1",
      "d +- w 0 h",
      "il ?: d l x1",
      "ir ?: d r x2",
      "it ?: d x1 t",
      "ib ?: d y2 b",
    ],
    paths: [
      {
        data: "M l x1 L x1 x1 L x1 t L x2 t L x2 x1 L r x1 L r y2 L x2 y2 L x2 b L x1 b L x1 y2 L l y2 Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  frame: {
    adjusts: ["adj1 val 12500"],
    guides: ["a1 pin 0 adj1 50000", "x1 */ ss a1 100000", "x4 +- r 0 x1", "y4 +- b 0 x1"],
    paths: [
      {
        data: "M l t L r t L r b L l b Z M x1 x1 L x1 y4 L x4 y4 L x4 x1 Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  corner: {
    adjusts: ["adj1 val 50000", "adj2 val 50000"],
    guides: [
      "maxAdj1 */ 100000 h ss",
      "maxAdj2 */ 100000 w ss",
      "a1 pin 0 adj1 maxAdj1",
      "a2 pin 0 adj2 maxAdj2",
      "x1 */ ss a2 100000",
      "dy1 */ ss a1 100000",
      "y1 +- b 0 dy1",
    ],
    paths: [
      {
        data: "M l t L x1 t L x1 y1 L r y1 L r b L l b Z",
        fill: true,
        stroke: true,
      },
    ],
  },
  star4: {
    adjusts: ["adj val 12500"],
    guides: [
      "a pin 0 adj 50000",
      "iwd2 */ wd2 a 50000",
      "ihd2 */ hd2 a 50000",
      "sdx */ iwd2 70711 100000",
      "sdy */ ihd2 70711 100000",
      "sx1 +- hc 0 sdx",
      "sx2 +- hc sdx 0",
      "sy1 +- vc 0 sdy",
      "sy2 +- vc sdy 0",
    ],
    paths: [
      {
        data: "M l vc L sx1 sy1 L hc t L sx2 sy1 L r vc L sx2 sy2 L hc b L sx1 sy2 Z",
        fill: true,
        stroke: true,
      },
    ],
  },
}

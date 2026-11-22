import { scene } from "@airdesign/document"
import {
  accentTick,
  box,
  columnOf,
  contentWidth,
  copy,
  footer,
  frame,
  iconOf,
  ink,
  margin,
  navy,
  pad,
  quiet,
  rowOf,
  slideTitle,
  solid,
  tile,
} from "../slide-kit.js"

const levers = [
  ["building-2", "Enterprise expansion", "Land larger accounts with multi-year agreements and a shared success plan."],
  ["wallet", "Pricing discipline", "Tie discounts to contract length and send every exception to one deal desk."],
  ["handshake", "Partner channel", "Add five integration partners that bring in qualified demand each quarter."],
  ["rocket", "Faster onboarding", "Cut the time to first value from 21 days to 7 with guided setup."],
  ["users", "Customer success", "Give every account over $100K a named owner and a quarterly plan."],
  [
    "chart-no-axes-column",
    "Operating leverage",
    "Hold support cost per ticket flat while ticket volume keeps growing.",
  ],
] as const

const lever = ([icon, title, body]: (typeof levers)[number], at: number) =>
  tile(`lever ${String(at + 1)}`, { sizing: { w: "fill", h: "fill" }, layout: columnOf(20, "top-left", pad(40)) }, [
    frame(
      `lever ${String(at + 1)} tile`,
      {
        box: box(0, 0, 80, 80),
        fills: [solid({ var: "accent1", tint: 0.9 })],
        radius: 20,
        layout: rowOf(0, "center-center"),
      },
      [iconOf(`lever ${String(at + 1)} icon`, icon, 44, navy, 2.5)],
    ),
    copy(`lever ${String(at + 1)} title`, title, { style: "heading", color: ink, size: 32 }),
    copy(`lever ${String(at + 1)} body`, body, { style: "body2", color: quiet, size: 25 }),
  ])

export function cardGrid(): scene.Grown {
  return scene.sceneFromTree({
    theme: scene.defaultTheme,
    slides: [
      {
        name: "Card grid",
        children: [
          accentTick(),
          slideTitle("Six levers carry the plan for the next phase of growth"),
          frame(
            "levers",
            {
              box: box(margin, 288, contentWidth, 660),
              layout: {
                mode: "grid",
                columns: [{ fr: 1 }, { fr: 1 }, { fr: 1 }],
                rows: [{ fr: 1 }, { fr: 1 }],
                gap: 32,
                padding: pad(0),
              },
            },
            levers.map(lever),
          ),
          ...footer("Source: 2026 operating plan", "7"),
        ],
      },
    ],
  })
}

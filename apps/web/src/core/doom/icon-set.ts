import * as doom from "@airdesign/doom"
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
  rowOf,
  slideTitle,
  solid,
  white,
} from "../slide-kit.js"

const light = [
  ["trending-up", "Growth"],
  ["chart-column", "Revenue"],
  ["users", "People"],
  ["target", "Focus"],
  ["shield-check", "Security"],
  ["globe", "Reach"],
] as const

const dark = [
  ["lightbulb", "Ideas"],
  ["rocket", "Launch"],
  ["layers", "Structure"],
  ["clock", "Time"],
  ["zap", "Speed"],
  ["settings", "Operations"],
] as const

const cell = (icon: string, label: string, inverse: boolean) =>
  frame(
    `cell ${icon}`,
    { box: box(0, 0, 100, 100), sizing: { w: "fill", h: "hug" }, layout: columnOf(22, "top-center") },
    [
      frame(
        `disc ${icon}`,
        {
          box: box(0, 0, 140, 140),
          radius: 70,
          fills: [solid(inverse ? navy : { var: "accent1", tint: 0.9 })],
          layout: rowOf(0, "center-center", pad(0)),
        },
        [iconOf(`icon ${icon}`, icon, 64, inverse ? white : navy, 3)],
      ),
      copy(`label ${icon}`, label, { style: "body2", color: ink, align: "center", size: 26 }),
    ],
  )

export function iconSet(): doom.Grown {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Icon set",
        children: [
          accentTick(),
          slideTitle("Icons are strokes you can recolour and reweigh"),
          frame(
            "icons",
            {
              box: box(margin, 330, contentWidth, 100),
              sizing: { w: "fixed", h: "hug" },
              layout: {
                mode: "grid",
                columns: Array.from({ length: 6 }, () => ({ fr: 1 })),
                rows: ["hug", "hug"],
                gap: 96,
                padding: pad(0),
              },
            },
            [
              ...light.map(([icon, label]) => cell(icon, label, false)),
              ...dark.map(([icon, label]) => cell(icon, label, true)),
            ],
          ),
          ...footer("Icons: Lucide, drawn as strokes at 3 px", "13"),
        ],
      },
    ],
  })
}

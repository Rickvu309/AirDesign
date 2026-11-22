import { scene } from "@airdesign/document"
import { box, columnOf, copy, frame, shape, sky, solid, white } from "../slide-kit.js"

const ring = (name: string, size: number, opacity: number) =>
  shape(name, {
    box: box(1600 - size / 2, 540 - size / 2, size, size),
    geometry: { kind: "ellipse" },
    strokes: [solid(sky, opacity)],
    stroke: { weight: 2.5, align: "center", dash: "solid" },
  })

export function titleSlide(): scene.Grown {
  return scene.sceneFromTree({
    theme: scene.defaultTheme,
    slides: [
      {
        name: "Title slide",
        props: {
          fills: [
            {
              kind: "gradient",
              shape: "linear",
              angle: 35,
              stops: [
                { at: 0, color: { var: "accent1" } },
                { at: 1, color: { var: "accent1", tint: -0.45 } },
              ],
            },
          ],
        },
        children: [
          ring("ring outer", 900, 0.3),
          ring("ring middle", 640, 0.4),
          ring("ring inner", 380, 0.5),
          shape("disc", {
            box: box(1600 - 110, 540 - 110, 220, 220),
            geometry: { kind: "ellipse" },
            fills: [solid(sky, 0.2)],
          }),
          frame("copy", { box: box(120, 330, 1040, 100), sizing: { w: "fixed", h: "hug" }, layout: columnOf(32) }, [
            copy("eyebrow", "Annual strategy review 2026", { style: "label", color: { var: "accent2", tint: 0.45 } }),
            copy("title", "Scaling profitable growth across three markets", {
              style: "title",
              color: white,
              size: 88,
              lineHeight: 1.08,
            }),
            copy("subtitle", "Where we invest, what we stop, and how we will measure it", {
              style: "body",
              color: { var: "accent2", tint: 0.72 },
              size: 32,
            }),
          ]),
          frame("rule", { box: box(120, 936, 1680, 2), fills: [solid(white, 0.25)] }),
          copy("meta", "Board of Directors  ·  March 2026", {
            style: "caption",
            color: { var: "accent2", tint: 0.72 },
            x: 120,
            y: 962,
            width: 900,
          }),
        ],
      },
    ],
  })
}

import { doom } from "@airdesign/document"
import {
  accentTick,
  box,
  columnOf,
  contentWidth,
  copy,
  footer,
  frame,
  ink,
  margin,
  quiet,
  rowOf,
  slideTitle,
} from "../slide-kit.js"

export const pictureAsset = "landscape"

const panel = (name: string, label: string, body: string, fill: doom.Paint) =>
  frame(name, { box: box(0, 0, 100, 100), sizing: { w: "fill", h: "hug" }, layout: columnOf(20) }, [
    frame(`${name} picture`, {
      box: box(0, 0, 100, 420),
      sizing: { w: "fill", h: "fixed" },
      fills: [fill],
      radius: 24,
      clip: true,
      effects: "soft",
    }),
    copy(`${name} label`, label, { style: "label", color: quiet }),
    copy(`${name} body`, body, { style: "body2", color: ink, size: 25 }),
  ])

export function pictureCrop(): doom.Grown {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Picture crop",
        children: [
          accentTick(),
          slideTitle("A picture is a fill: it can fill, crop or take a filter"),
          frame(
            "panels",
            { box: box(margin, 288, contentWidth, 100), sizing: { w: "fixed", h: "hug" }, layout: rowOf(56) },
            [
              panel("filled", "Fill", "The whole picture covers the frame and the edges that do not fit are cut.", {
                kind: "image",
                asset: pictureAsset,
                fit: "fill",
              }),
              panel(
                "cropped",
                "Crop",
                "Only the part inside the crop shows, here the peak and the sun above the lake.",
                { kind: "image", asset: pictureAsset, fit: "crop", crop: { x: 0.36, y: 0.14, w: 0.44, h: 0.5 } },
              ),
              panel(
                "filtered",
                "Filter",
                "Saturation and contrast change how the same picture reads, with no second copy of it.",
                { kind: "image", asset: pictureAsset, fit: "fill", filters: { saturation: -1, contrast: 0.15 } },
              ),
            ],
          ),
          ...footer("Picture: sample landscape drawn for this page", "17"),
        ],
      },
    ],
  })
}

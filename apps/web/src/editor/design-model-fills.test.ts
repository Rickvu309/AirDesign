import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import type { PanelControl } from "@/design/panel"
import { pictureCopy } from "@/copy/picture-copy"
import { nodeModel } from "./design-model"

const photo = doom.doomFromTree({
  theme: doom.defaultTheme,
  slides: [
    {
      children: [
        {
          type: "shape",
          name: "photo",
          props: {
            box: { x: 500, y: 300, w: 200, h: 100, rotation: 0, flipH: false, flipV: false },
            geometry: { kind: "rect" },
            fills: [{ kind: "image", asset: "a".repeat(64), fit: "fit" }],
          },
        },
      ],
    },
  ],
})

const model = nodeModel({
  view: photo.doom,
  id: photo.ids.photo!,
  theme: doom.defaultTheme,
  slides: photo.slides,
})

const controls: readonly PanelControl[] = model.sections.flatMap((section) => section.strips.flat())

describe("a picture's panel", () => {
  it("carries no icon search and no second block beside its fills", () => {
    expect(controls.some((control) => control.field === "source")).toBe(false)
    expect(model.sections.map((section) => section.trait)).not.toContain("image")
  })

  it("names the fit menu Fill mode, as Figma does", () => {
    const mode = controls.find((control) => control.trait === "image" && control.field === "mode")
    expect(mode?.label).toBe(pictureCopy.mode)
    expect(mode?.look.name.show).toBe("above")
  })
})

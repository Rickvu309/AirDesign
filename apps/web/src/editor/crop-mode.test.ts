import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import type { PanelControl } from "@/design/panel"
import { changeWrites } from "./design-changes"
import { nodeModel } from "./design-model"
import { geometryOf } from "./slide-geometry"
import { testTheme } from "@airdesign/doom/testing"

const spot = (x: number, y: number, w: number, h: number, rotation = 0) => ({
  x,
  y,
  w,
  h,
  rotation,
  flipH: false,
  flipV: false,
})

function grow(children: readonly doom.TreeNode[]) {
  const grown = doom.doomFromTree({ theme: testTheme, slides: [{ children }] })
  const measure = doom.measureWith({})
  const geometry = geometryOf(doom.resolveSlide(grown.doom, grown.slides[0]!, measure))
  return { ...grown, view: grown.doom, geometry, measure }
}

const asset = "a".repeat(64)
const window = { x: 0.1, y: 0, w: 0.5, h: 1 }

const made = grow([
  {
    type: "shape",
    name: "photo",
    props: {
      box: spot(100, 100, 200, 100),
      geometry: { kind: "rect" },
      fills: [{ kind: "image", asset, fit: "crop", crop: window }],
    } as never,
  },
])
const id = made.ids.photo as doom.NodeId

function modeControl(view: doom.Doom): PanelControl {
  const model = nodeModel({ view, id, theme: testTheme, slides: [] })
  const found = model.sections.flatMap((section) => section.strips.flat()).find((control) => control.field === "mode")
  if (found === undefined) throw new Error("no mode control")
  return found
}

const context = (view: doom.Doom) => ({
  view,
  ids: [id],
  geometry: made.geometry,
  size: { w: 1920, h: 1080 },
  slides: [],
})

describe("the picture's Fill mode in the design panel", () => {
  it("offers Fill, Fit and Crop, and shows the current mode", () => {
    const control = modeControl(made.view)
    expect(control.value).toBe("crop")
    expect(control.desc).toEqual({ kind: "choice", options: ["fill", "fit", "crop"] })
  })

  it("keeps the crop when Crop is picked again, and drops it when another mode is picked", () => {
    const again = changeWrites(context(made.view), modeControl(made.view), "crop")
    expect(doom.propOf(made.view.nodes.get(id), "fills")).toMatchObject([{ fit: "crop", crop: window }])
    expect(again.every((write) => (write.value as { crop?: unknown }[])[0]?.crop !== undefined)).toBe(true)
    const [filled] = changeWrites(context(made.view), modeControl(made.view), "fill")
    expect(filled?.value).toEqual([{ kind: "image", asset, fit: "fill" }])
  })

  it("sets Crop on a Fill picture without a window, so it looks the same until it is cropped", () => {
    const plain = grow([
      {
        type: "shape",
        name: "photo",
        props: {
          box: spot(0, 0, 200, 100),
          geometry: { kind: "rect" },
          fills: [{ kind: "image", asset, fit: "fill" }],
        } as never,
      },
    ])
    const plainId = plain.ids.photo as doom.NodeId
    const [cropped] = changeWrites({ ...context(plain.view), ids: [plainId] }, modeControl(made.view), "crop")
    expect(cropped?.value).toEqual([{ kind: "image", asset, fit: "crop" }])
  })
})

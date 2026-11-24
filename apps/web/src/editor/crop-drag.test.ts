import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { cropDrag, cropShown, type CropGrip } from "./crop-drag"
import { geometryOf } from "./slide-geometry"

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
  const grown = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children }] })
  const measure = doom.measureWith({})
  const geometry = geometryOf(doom.resolveSlide(grown.doom, grown.slides[0]!, measure))
  return { ...grown, view: grown.doom, geometry, measure }
}

const asset = "a".repeat(64)
const wide = { width: 400, height: 200 }

const deck = (box = spot(100, 100, 200, 100), crop?: { x: number; y: number; w: number; h: number }) =>
  grow([
    {
      type: "shape",
      name: "photo",
      props: {
        box,
        geometry: { kind: "rect" },
        fills: [{ kind: "image", asset, fit: "crop", ...(crop === undefined ? {} : { crop }) }],
      } as never,
    },
  ])

type Props = Readonly<Record<string, unknown>>
const written = (writes: readonly { readonly prop: string; readonly value: unknown }[], prop: string) =>
  writes.find((write) => write.prop === prop)?.value as Props | undefined
const crop = (writes: readonly { readonly prop: string; readonly value: unknown }[]) =>
  (written(writes, "fills") as unknown as readonly { crop: Props }[])[0]!.crop

function drag(
  made: ReturnType<typeof deck>,
  grip: CropGrip,
  by: { x: number; y: number },
  natural: { width: number; height: number } | null = wide,
) {
  const origin = { x: 150, y: 150 }
  return cropDrag({
    view: made.view,
    geometry: made.geometry,
    node: made.ids.photo as never,
    grip,
    origin,
    at: { x: origin.x + by.x, y: origin.y + by.y },
    natural,
  })
}

describe("the part of the picture a cropping layer shows", () => {
  it("is the stored crop, or what Fill shows when none is stored and the picture's shape is known", () => {
    const stored = deck(spot(0, 0, 200, 100), { x: 0.1, y: 0, w: 0.5, h: 1 })
    const paint = stored.view.nodes.get(stored.ids.photo as never)
    expect(cropShown(stored.view, stored.ids.photo as never, null)).toEqual({ x: 0.1, y: 0, w: 0.5, h: 1 })
    expect(paint).toBeDefined()
    const bare = deck(spot(0, 0, 100, 100))
    expect(cropShown(bare.view, bare.ids.photo as never, wide)).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 })
    expect(cropShown(bare.view, bare.ids.photo as never, null)).toBeNull()
  })
})

describe("dragging the picture inside its frame", () => {
  it("moves the part that shows the other way, and keeps the frame", () => {
    const made = deck(spot(100, 100, 100, 100), { x: 0.25, y: 0, w: 0.5, h: 1 })
    const writes = drag(made, "crop-move", { x: 20, y: 30 })
    expect(crop(writes)).toEqual({ x: 0.15, y: 0, w: 0.5, h: 1 })
    expect(written(writes, "box")).toBeUndefined()
  })

  it("stops where the picture's edge meets the frame's edge", () => {
    const made = deck(spot(100, 100, 100, 100), { x: 0.25, y: 0, w: 0.5, h: 1 })
    expect(crop(drag(made, "crop-move", { x: 5000, y: 0 })).x).toBe(0)
    expect(crop(drag(made, "crop-move", { x: -5000, y: 0 })).x).toBe(0.5)
  })

  it("starts from what Fill showed when no crop was stored", () => {
    const made = deck(spot(100, 100, 100, 100))
    expect(crop(drag(made, "crop-move", { x: 0, y: 0 }))).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 })
  })

  it("writes nothing when the picture's shape is not known yet and no crop is stored", () => {
    expect(drag(deck(spot(100, 100, 100, 100)), "crop-move", { x: 10, y: 0 }, null)).toEqual([])
  })
})

describe("dragging a crop handle", () => {
  it("cuts more from that side and shrinks the frame by as much, keeping the picture's scale", () => {
    const made = deck(spot(100, 100, 200, 100), { x: 0, y: 0, w: 1, h: 1 })
    const writes = drag(made, "crop-w", { x: 50, y: 0 })
    expect(written(writes, "box")).toMatchObject({ x: 150, y: 100, w: 150, h: 100 })
    expect(crop(writes)).toEqual({ x: 0.25, y: 0, w: 0.75, h: 1 })
  })

  it("cuts two sides at once from a corner", () => {
    const made = deck(spot(100, 100, 200, 100), { x: 0, y: 0, w: 1, h: 1 })
    const writes = drag(made, "crop-se", { x: -40, y: -20 })
    expect(written(writes, "box")).toMatchObject({ x: 100, y: 100, w: 160, h: 80 })
    expect(crop(writes)).toEqual({ x: 0, y: 0, w: 0.8, h: 0.8 })
  })

  it("never pulls a side past the picture, so it cannot show empty space", () => {
    const made = deck(spot(100, 100, 200, 100), { x: 0.1, y: 0, w: 0.8, h: 1 })
    const writes = drag(made, "crop-w", { x: -5000, y: 0 })
    expect(crop(writes)).toEqual({ x: 0, y: 0, w: 0.9, h: 1 })
    expect(written(writes, "box")).toMatchObject({ x: 75, w: 225 })
  })

  it("leaves a frame no smaller than a handle's reach", () => {
    const made = deck(spot(100, 100, 200, 100), { x: 0, y: 0, w: 1, h: 1 })
    expect(written(drag(made, "crop-e", { x: -5000, y: 0 }), "box")).toMatchObject({ w: 16 })
  })

  it("keeps the opposite side where it was when the layer is turned", () => {
    const made = deck(spot(100, 100, 200, 100, 90), { x: 0, y: 0, w: 1, h: 1 })
    const before = made.geometry.byId.get(made.ids.photo as never)!.corners
    const writes = drag(made, "crop-e", { x: 0, y: -50 })
    expect(written(writes, "box")).toMatchObject({ w: 150, h: 100, rotation: 90 })
    const box = written(writes, "box") as unknown as { x: number; y: number; w: number; h: number }
    const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    const start = { x: 200, y: 150 }
    expect(before).toHaveLength(4)
    expect(centre.x).toBeCloseTo(start.x, 0)
    expect(centre.y).toBeCloseTo(start.y - 25, 0)
  })

  it("cuts the mirrored side when the layer is flipped across", () => {
    const made = deck({ ...spot(100, 100, 200, 100), flipH: true }, { x: 0, y: 0, w: 1, h: 1 })
    const writes = drag(made, "crop-w", { x: 50, y: 0 })
    expect(written(writes, "box")).toMatchObject({ x: 150, w: 150 })
    expect(crop(writes)).toEqual({ x: 0, y: 0, w: 0.75, h: 1 })
  })
})

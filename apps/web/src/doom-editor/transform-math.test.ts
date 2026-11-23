import { nodeId } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import {
  flipSelection,
  resizeBox,
  resizeCursor,
  resizeSelection,
  rotateCursor,
  rotatedAngle,
  selectionFrame,
  visualBounds,
  type Corner,
  type FlippableLayer,
  type ResizeGrip,
  type RotatedLayer,
} from "./transform-math"

type Box = Parameters<typeof resizeBox>[0]

const base: Box = { x: 1_000_000, y: 2_000_000, w: 4_000_000, h: 2_000_000 }
const free = { keepRatio: false, fromCenter: false } as const
const proportional = { keepRatio: true, fromCenter: false } as const
const centered = { keepRatio: false, fromCenter: true } as const
const both = { keepRatio: true, fromCenter: true } as const

function screenPoint(box: Box, grip: ResizeGrip, degrees: number): { readonly x: number; readonly y: number } {
  const rad = (degrees * Math.PI) / 180
  const sx = grip.includes("left") ? -1 : grip.includes("right") ? 1 : 0
  const sy = grip.includes("top") ? -1 : grip.includes("bottom") ? 1 : 0
  const lx = (sx * box.w) / 2
  const ly = (sy * box.h) / 2
  return {
    x: box.x + box.w / 2 + lx * Math.cos(rad) - ly * Math.sin(rad),
    y: box.y + box.h / 2 + lx * Math.sin(rad) + ly * Math.cos(rad),
  }
}

const oppositeGrip: Readonly<Record<ResizeGrip, ResizeGrip>> = {
  "top-left": "bottom-right",
  "top-right": "bottom-left",
  "bottom-left": "top-right",
  "bottom-right": "top-left",
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
}

describe("resizeBox", () => {
  it.each([
    ["bottom-right", 200_000, 100_000, { x: 1_000_000, y: 2_000_000, w: 4_200_000, h: 2_100_000 }],
    ["top-left", 200_000, 100_000, { x: 1_200_000, y: 2_100_000, w: 3_800_000, h: 1_900_000 }],
    ["top-right", 200_000, 100_000, { x: 1_000_000, y: 2_100_000, w: 4_200_000, h: 1_900_000 }],
    ["bottom-left", 200_000, 100_000, { x: 1_200_000, y: 2_000_000, w: 3_800_000, h: 2_100_000 }],
  ] as const)("resizes freely from corner %s while pinning the opposite corner", (grip, dx, dy, expected) => {
    expect(resizeBox(base, grip, dx, dy, free)).toEqual(expected)
  })

  it.each([
    ["right", 300_000, 500_000, { x: 1_000_000, y: 2_000_000, w: 4_300_000, h: 2_000_000 }],
    ["left", 300_000, 500_000, { x: 1_300_000, y: 2_000_000, w: 3_700_000, h: 2_000_000 }],
    ["bottom", 500_000, 300_000, { x: 1_000_000, y: 2_000_000, w: 4_000_000, h: 2_300_000 }],
    ["top", 500_000, 300_000, { x: 1_000_000, y: 2_300_000, w: 4_000_000, h: 1_700_000 }],
  ] as const)("resizes only the dragged axis on edge %s", (edge, dx, dy, expected) => {
    expect(resizeBox(base, edge, dx, dy, free)).toEqual(expected)
  })

  it("resizes an edge down to a 4 pt accent bar, as Figma does", () => {
    const bar = 50_800
    expect(resizeBox(base, "bottom", 0, bar - base.h, free)).toEqual({ ...base, h: bar })
    expect(resizeBox(base, "top", 0, base.h - bar, free)).toEqual({ ...base, y: base.y + base.h - bar, h: bar })
  })

  it("stops an edge or corner resize at zero without moving the opposite edge", () => {
    expect(resizeBox(base, "left", 10_000_000, 0, free)).toEqual({ x: base.x + base.w, y: base.y, w: 0, h: base.h })
    expect(resizeBox(base, "top", 0, 10_000_000, free)).toEqual({ x: base.x, y: base.y + base.h, w: base.w, h: 0 })
    expect(resizeBox(base, "right", -10_000_000, 0, free)).toEqual({ ...base, w: 0 })
    expect(resizeBox(base, "bottom", 0, -10_000_000, free)).toEqual({ ...base, h: 0 })
  })

  it("keeps aspect ratio with Shift on corners and pins the opposite corner", () => {
    expect(resizeBox(base, "bottom-right", 800_000, 0, proportional)).toEqual({
      x: 1_000_000,
      y: 2_000_000,
      w: 4_800_000,
      h: 2_400_000,
    })
    expect(resizeBox(base, "top-left", 0, 500_000, proportional)).toEqual({
      x: 2_000_000,
      y: 2_500_000,
      w: 3_000_000,
      h: 1_500_000,
    })
  })

  it("keeps aspect ratio with Shift on edges and pins the opposite edge midpoint", () => {
    expect(resizeBox(base, "right", 1_000_000, 0, proportional)).toEqual({
      x: 1_000_000,
      y: 1_750_000,
      w: 5_000_000,
      h: 2_500_000,
    })
    expect(resizeBox(base, "left", 1_000_000, 0, proportional)).toEqual({
      x: 2_000_000,
      y: 2_250_000,
      w: 3_000_000,
      h: 1_500_000,
    })
    expect(resizeBox(base, "bottom", 0, 500_000, proportional)).toEqual({
      x: 500_000,
      y: 2_000_000,
      w: 5_000_000,
      h: 2_500_000,
    })
    expect(resizeBox(base, "top", 0, 500_000, proportional)).toEqual({
      x: 1_500_000,
      y: 2_500_000,
      w: 3_000_000,
      h: 1_500_000,
    })
  })

  it("resizes symmetrically from center with Alt on corners and edges", () => {
    expect(resizeBox(base, "bottom-right", 200_000, 100_000, centered)).toEqual({
      x: 800_000,
      y: 1_900_000,
      w: 4_400_000,
      h: 2_200_000,
    })
    expect(resizeBox(base, "top-left", 200_000, 100_000, centered)).toEqual({
      x: 1_200_000,
      y: 2_100_000,
      w: 3_600_000,
      h: 1_800_000,
    })
    expect(resizeBox(base, "right", 250_000, 999_999, centered)).toEqual({
      x: 750_000,
      y: 2_000_000,
      w: 4_500_000,
      h: 2_000_000,
    })
    expect(resizeBox(base, "top", 999_999, -200_000, centered)).toEqual({
      x: 1_000_000,
      y: 1_800_000,
      w: 4_000_000,
      h: 2_400_000,
    })
  })

  it("combines Shift and Alt to resize proportionally from center on corners and edges", () => {
    const cornerResized = resizeBox(base, "bottom-right", 400_000, 0, both)
    expect(cornerResized).toEqual({
      x: 600_000,
      y: 1_800_000,
      w: 4_800_000,
      h: 2_400_000,
    })
    expect(cornerResized.x + cornerResized.w / 2).toBe(base.x + base.w / 2)
    expect(cornerResized.y + cornerResized.h / 2).toBe(base.y + base.h / 2)

    const edgeResized = resizeBox(base, "top", 0, -250_000, both)
    expect(edgeResized).toEqual({
      x: 500_000,
      y: 1_750_000,
      w: 5_000_000,
      h: 2_500_000,
    })
  })

  it.each(["bottom-right", "right", "top"] as const)(
    "keeps the center fixed on screen when Alt-resizing a 45-degree rotated box from %s",
    (grip) => {
      const next = resizeBox(base, grip, 250_000, 120_000, both, 45)
      expect(Math.abs(next.x + next.w / 2 - (base.x + base.w / 2))).toBeLessThanOrEqual(1)
      expect(Math.abs(next.y + next.h / 2 - (base.y + base.h / 2))).toBeLessThanOrEqual(1)
      expect(next.w / next.h).toBeCloseTo(base.w / base.h, 4)
    },
  )

  it.each(["top-left", "bottom-right", "right", "top"] as const)(
    "preserves aspect ratio and pins the opposite anchor when Shift-resizing a 30-degree rotated box from %s",
    (grip) => {
      const next = resizeBox(base, grip, 300_000, 120_000, proportional, 30)
      const anchorBefore = screenPoint(base, oppositeGrip[grip], 30)
      const anchorAfter = screenPoint(next, oppositeGrip[grip], 30)
      expect(Math.abs(anchorAfter.x - anchorBefore.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(anchorAfter.y - anchorBefore.y)).toBeLessThanOrEqual(1)
      expect(next.w / next.h).toBeCloseTo(base.w / base.h, 4)
    },
  )
})

describe("selectionFrame and resizeSelection", () => {
  const first = nodeId("s:2")
  const second = nodeId("s:3")
  const boxA: Box = { x: 1_000_000, y: 1_000_000, w: 2_000_000, h: 1_000_000 }
  const boxB: Box = { x: 4_000_000, y: 2_500_000, w: 1_000_000, h: 1_500_000 }

  function layers(): ReadonlyMap<typeof first, RotatedLayer> {
    return new Map([
      [first, { box: boxA, rotation: 0 }],
      [second, { box: boxB, rotation: 0 }],
    ])
  }

  it("computes visual bounds of a rotated layer", () => {
    const upright: Box = { x: 1_000_000, y: 1_000_000, w: 2_000_000, h: 1_000_000 }
    expect(visualBounds(upright, 90)).toEqual({ x: 1_500_000, y: 500_000, w: 1_000_000, h: 2_000_000 })
  })

  it("computes the shared bounding box across multiple layers", () => {
    expect(selectionFrame(layers())).toEqual({ x: 1_000_000, y: 1_000_000, w: 4_000_000, h: 3_000_000 })
  })

  it("scales positions and sizes together on multi-selection corner resize", () => {
    const result = resizeSelection(layers(), "bottom-right", 2_000_000, 1_500_000, free)
    expect(result.frame).toEqual({ x: 1_000_000, y: 1_000_000, w: 6_000_000, h: 4_500_000 })
    expect(result.boxes.get(first)).toEqual({ x: 1_000_000, y: 1_000_000, w: 3_000_000, h: 1_500_000 })
    expect(result.boxes.get(second)).toEqual({ x: 5_500_000, y: 3_250_000, w: 1_500_000, h: 2_250_000 })
  })

  it("scales only one axis on multi-selection edge resize", () => {
    const result = resizeSelection(layers(), "right", 2_000_000, 999_999, free)
    expect(result.boxes.get(first)).toEqual({ x: 1_000_000, y: 1_000_000, w: 3_000_000, h: 1_000_000 })
    expect(result.boxes.get(second)).toEqual({ x: 5_500_000, y: 2_500_000, w: 1_500_000, h: 1_500_000 })
  })

  it("supports Shift and Alt when resizing a multi-selection", () => {
    const result = resizeSelection(layers(), "bottom-right", 1_000_000, 0, both)
    expect(result.frame).toEqual({ x: 0, y: 250_000, w: 6_000_000, h: 4_500_000 })
    expect(result.boxes.get(first)).toEqual({ x: 0, y: 250_000, w: 3_000_000, h: 1_500_000 })
    expect(result.boxes.get(second)).toEqual({ x: 4_500_000, y: 2_500_000, w: 1_500_000, h: 2_250_000 })
  })

  it("scales a 90-degree rotated member along its visual screen axis inside a multi-selection", () => {
    const rotated = new Map([
      [first, { box: { x: 1_000_000, y: 1_000_000, w: 2_000_000, h: 1_000_000 }, rotation: 90 }],
      [second, { box: { x: 3_000_000, y: 500_000, w: 1_000_000, h: 2_000_000 }, rotation: 0 }],
    ])
    const result = resizeSelection(rotated, "right", 2_500_000, 0, free)
    const firstBox = result.boxes.get(first)
    expect(firstBox?.w).toBe(2_000_000)
    expect(firstBox?.h).toBe(2_000_000)
  })

  it("shrinks every member of a multi-selection down to zero and never below", () => {
    const result = resizeSelection(layers(), "bottom-right", -10_000_000, -10_000_000, free)
    for (const member of [first, second]) {
      expect(result.boxes.get(member)?.w).toBe(0)
      expect(result.boxes.get(member)?.h).toBe(0)
    }
  })
})

describe("rotatedAngle and rotateSelection", () => {
  const center = { x: 200, y: 200 }

  it("computes clockwise rotation in [0, 360) rounded to tenths", () => {
    expect(rotatedAngle(center, { x: 300, y: 200 }, { x: 200, y: 300 }, 0, false)).toBe(90)
    expect(rotatedAngle(center, { x: 300, y: 200 }, { x: 200, y: 100 }, 0, false)).toBe(270)
    expect(rotatedAngle(center, { x: 300, y: 200 }, { x: 300, y: 300 }, 45, false)).toBe(90)
  })

  it("snaps rotation to 15-degree increments when Shift is held", () => {
    const angleFor = (deg: number) => {
      const rad = (deg * Math.PI) / 180
      return { x: center.x + Math.cos(rad) * 100, y: center.y + Math.sin(rad) * 100 }
    }
    expect(rotatedAngle(center, angleFor(0), angleFor(8), 0, true)).toBe(15)
    expect(rotatedAngle(center, angleFor(0), angleFor(7), 0, true)).toBe(0)
    expect(rotatedAngle(center, angleFor(0), angleFor(37), 0, true)).toBe(30)
    expect(rotatedAngle(center, angleFor(0), angleFor(38), 0, true)).toBe(45)
    expect(rotatedAngle(center, angleFor(0), angleFor(355), 0, true)).toBe(0)
    expect(rotatedAngle(center, angleFor(0), angleFor(10), 22, true)).toBe(30)
    expect(rotatedAngle(center, angleFor(0), angleFor(340), 10, false)).toBe(350)
    expect(rotatedAngle(center, angleFor(0), angleFor(340), 10, true)).toBe(345)
  })
})

describe("flipSelection", () => {
  const first = nodeId("s:2")
  const second = nodeId("s:3")

  it("toggles only flipH or flipV on a single upright layer", () => {
    const single = new Map<typeof first, FlippableLayer>([
      [first, { box: base, rotation: 0, flipH: false, flipV: true }],
    ])
    expect(flipSelection(single, "horizontal")).toEqual([{ id: first, flipH: true }])
    expect(flipSelection(single, "vertical")).toEqual([{ id: first, flipV: false }])
  })

  it("mirrors a single turned layer on screen, so 30 degrees turns to 330 as the flip toggles", () => {
    const single = new Map<typeof first, FlippableLayer>([
      [first, { box: base, rotation: 30, flipH: false, flipV: true }],
    ])
    expect(flipSelection(single, "horizontal")).toEqual([{ id: first, rotation: 330, flipH: true }])
    expect(flipSelection(single, "vertical")).toEqual([{ id: first, rotation: 330, flipV: false }])
  })

  it("mirrors positions and flags across an upright multi-selection", () => {
    const upright = new Map<typeof first, FlippableLayer>([
      [
        first,
        { box: { x: 1_000_000, y: 1_000_000, w: 1_000_000, h: 1_000_000 }, rotation: 0, flipH: false, flipV: false },
      ],
      [
        second,
        { box: { x: 4_000_000, y: 2_000_000, w: 2_000_000, h: 1_000_000 }, rotation: 0, flipH: true, flipV: false },
      ],
    ])
    expect(flipSelection(upright, "horizontal")).toEqual([
      {
        id: first,
        box: { x: 5_000_000, y: 1_000_000, w: 1_000_000, h: 1_000_000 },
        flipH: true,
      },
      {
        id: second,
        box: { x: 1_000_000, y: 2_000_000, w: 2_000_000, h: 1_000_000 },
        flipH: false,
      },
    ])
    expect(flipSelection(upright, "vertical")).toEqual([
      {
        id: first,
        box: { x: 1_000_000, y: 2_000_000, w: 1_000_000, h: 1_000_000 },
        flipV: true,
      },
      {
        id: second,
        box: { x: 4_000_000, y: 1_000_000, w: 2_000_000, h: 1_000_000 },
        flipV: true,
      },
    ])
  })

  it("reflects rotation and keeps the visual selection frame when flipping a multi-selection with a rotated layer", () => {
    const multi = new Map<typeof first, FlippableLayer>([
      [
        first,
        { box: { x: 1_000_000, y: 1_000_000, w: 1_000_000, h: 1_000_000 }, rotation: 30, flipH: false, flipV: false },
      ],
      [
        second,
        { box: { x: 4_000_000, y: 2_000_000, w: 2_000_000, h: 1_000_000 }, rotation: 0, flipH: true, flipV: false },
      ],
    ])
    const beforeFrame = selectionFrame(multi)
    const flipped = flipSelection(multi, "horizontal")
    expect(flipped[0]?.rotation).toBe(330)
    expect(flipped[0]?.flipH).toBe(true)
    const afterMap = new Map<typeof first, RotatedLayer>(
      flipped.map((item) => [
        item.id,
        { box: item.box ?? multi.get(item.id)!.box, rotation: item.rotation ?? multi.get(item.id)!.rotation },
      ]),
    )
    const afterFrame = selectionFrame(afterMap)
    expect(Math.abs((afterFrame?.x ?? 0) - (beforeFrame?.x ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((afterFrame?.w ?? 0) - (beforeFrame?.w ?? 0))).toBeLessThanOrEqual(1)
  })
})

describe("cursors and HUD labels", () => {
  it("picks rotated resize cursors for corners and edges", () => {
    expect(resizeCursor("top", 0)).toBe("ns-resize")
    expect(resizeCursor("right", 0)).toBe("ew-resize")
    expect(resizeCursor("top", 90)).toBe("ew-resize")
    expect(resizeCursor("right", 45)).toBe("nwse-resize")
    expect(resizeCursor("bottom-right", 0)).toBe("nwse-resize")
    expect(resizeCursor("bottom-right", 30)).toBe("ns-resize")
    expect(resizeCursor("top-right", 30)).toBe("ew-resize")
  })

  it("builds a data-URI rotate cursor with outward arrowheads for each corner and rotation", () => {
    const corners: readonly Corner[] = ["top-right", "bottom-right", "bottom-left", "top-left"]
    corners.forEach((corner, index) => {
      const value = rotateCursor(corner, 30)
      expect(value).toContain('url("data:image/svg+xml,')
      expect(value).toContain("12 12, grab")
      const decoded = decodeURIComponent(value)
      expect(decoded).toContain(`rotate(${String(index * 90 + 30)} 12 12)`)
      expect(decoded).toContain("M10.5 6 L8 8.5 L10.5 11")
      expect(decoded).toContain("M13 13.5 L15.5 16 L18 13.5")
    })
  })
})

import { describe, expect, it } from "vitest"
import { measureWith, slideStarts, type Resolved, type Theme } from "@airdesign/doom"
import { layoutPictures, readLayoutPictures, warmLayoutPictures, type LayoutPicture } from "@/editor/layout-pictures"
import { testTheme } from "@airdesign/doom/testing"

const measure = measureWith({})
const wide = { w: 1920, h: 1080 }
const color = (seed: number): `#${string}` => `#${seed.toString(16).padStart(6, "0")}`
const roseGround = color(0x111827)
const roseText = color(0xf8fafc)
const rose: Theme = {
  ...testTheme,
  colors: { ...testTheme.colors, background: roseGround, text: roseText },
}

function solids(picture: LayoutPicture): string[] {
  const colors: string[] = []
  const walk = (nodes: readonly Resolved[]) => {
    for (const node of nodes) {
      for (const fill of [...node.fills, ...node.strokes]) if (fill.kind === "solid") colors.push(fill.color)
      if (node.text !== null) for (const line of node.text.lines) for (const run of line.runs) colors.push(run.color)
      walk(node.children)
    }
  }
  walk(picture.nodes)
  for (const fill of picture.background) if (fill.kind === "solid") colors.push(fill.color)
  return colors
}

function widest(picture: LayoutPicture): number {
  const walk = (nodes: readonly Resolved[]): number =>
    nodes.reduce((room, node) => Math.max(room, node.box.w, walk(node.children)), 0)
  return walk(picture.nodes)
}

describe("layout pictures", () => {
  it("paints each listed layout from the deck theme, size and slide background, and reuses that picture", async () => {
    const plain = layoutPictures(testTheme, wide, undefined, measure)
    const themed = layoutPictures(rose, wide, undefined, measure)
    expect(Object.keys(plain)).toEqual([...slideStarts])
    expect(plain.blank.background).toEqual([{ kind: "solid", color: testTheme.colors.background, opacity: 1 }])
    expect(themed.blank.background).toEqual([{ kind: "solid", color: roseGround, opacity: 1 }])
    expect(solids(plain.title)).toContain(testTheme.colors.text)
    expect(solids(themed.title)).toContain(roseText)
    expect(solids(themed.title)).not.toContain(testTheme.colors.text)
    expect(plain.title.size).toEqual(wide)
    expect(widest(plain.title)).toBe(1600)
    const narrow = layoutPictures(testTheme, { w: 1280, h: 720 }, undefined, measure)
    expect(narrow.title.size).toEqual({ w: 1280, h: 720 })
    expect(widest(narrow.title)).toBe(1066)
    const fills = [{ kind: "solid" as const, color: roseGround }]
    const filled = layoutPictures(testTheme, wide, fills, measure)
    expect(filled.blank.background).toEqual([{ kind: "solid", color: roseGround, opacity: 1 }])
    expect(layoutPictures(testTheme, { w: wide.w, h: wide.h }, undefined, measure)).toBe(plain)
    let measured = 0
    await expect(
      warmLayoutPictures(testTheme, wide, undefined, () => {
        measured += 1
        return Promise.resolve(measure)
      }),
    ).resolves.toBe(plain)
    expect(measured).toBe(0)
    const fresh: Theme = { ...rose, colors: { ...rose.colors, accent2: color(0x123456) } }
    let calls = 0
    const warmed = await warmLayoutPictures(fresh, wide, undefined, async () => {
      calls += 1
      return measure
    })
    expect(calls).toBe(1)
    expect(warmed.blank.background).toEqual([{ kind: "solid", color: roseGround, opacity: 1 }])
    expect(readLayoutPictures(fresh, wide, undefined)).toBe(warmed)
    await expect(warmLayoutPictures(fresh, wide, undefined, async () => measure)).resolves.toBe(warmed)
  })

  it("warms in slices: pauses before measuring, then grows and resolves each layout in slices", async () => {
    const sliced: Theme = { ...rose, colors: { ...rose.colors, accent2: color(0x654321) } }
    let pauses = 0
    let measuredAfter = -1
    const warmed = await warmLayoutPictures(
      sliced,
      wide,
      undefined,
      async () => {
        measuredAfter = pauses
        return measure
      },
      async () => {
        pauses += 1
        expect(readLayoutPictures(sliced, wide, undefined)).toBeNull()
      },
    )
    expect(measuredAfter).toBe(1)
    expect(pauses).toBe(slideStarts.length * 2 + 2)
    expect(readLayoutPictures(sliced, wide, undefined)).toBe(warmed)
  })
})

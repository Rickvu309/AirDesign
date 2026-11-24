import { describe, expect, it } from "vitest"
import { defaultTheme, measureWith, slideStarts, type Resolved, type Theme } from "@airdesign/doom"
import { layoutPictures, readLayoutPictures, warmLayoutPictures, type LayoutPicture } from "@/editor/layout-pictures"

const measure = measureWith({})
const wide = { w: 1920, h: 1080 }
const color = (seed: number): `#${string}` => `#${seed.toString(16).padStart(6, "0")}`
const roseGround = color(0x111827)
const roseAccent = color(0xe11d48)
const rose: Theme = {
  ...defaultTheme,
  colors: { ...defaultTheme.colors, accent1: roseAccent, background: roseGround, text: color(0xf8fafc) },
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
    const plain = layoutPictures(defaultTheme, wide, undefined, measure)
    const themed = layoutPictures(rose, wide, undefined, measure)
    expect(Object.keys(plain)).toEqual([...slideStarts])
    expect(plain.blank.background).toEqual([{ kind: "solid", color: defaultTheme.colors.background, opacity: 1 }])
    expect(themed.blank.background).toEqual([{ kind: "solid", color: roseGround, opacity: 1 }])
    expect(solids(plain.chart)).toContain(defaultTheme.colors.accent1)
    expect(solids(themed.chart)).toContain(roseAccent)
    expect(solids(themed.chart)).not.toContain(defaultTheme.colors.accent1)
    expect(plain.title.size).toEqual(wide)
    expect(widest(plain.title)).toBe(1600)
    const narrow = layoutPictures(defaultTheme, { w: 1280, h: 720 }, undefined, measure)
    expect(narrow.title.size).toEqual({ w: 1280, h: 720 })
    expect(widest(narrow.title)).toBe(1066)
    const fills = [{ kind: "solid" as const, color: roseGround }]
    const filled = layoutPictures(defaultTheme, wide, fills, measure)
    expect(filled.blank.background).toEqual([{ kind: "solid", color: roseGround, opacity: 1 }])
    expect(layoutPictures(defaultTheme, { w: wide.w, h: wide.h }, undefined, measure)).toBe(plain)
    let measured = 0
    await expect(
      warmLayoutPictures(defaultTheme, wide, undefined, () => {
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

  it("warms in slices: one pause to start, one per layout to grow, one to measure, one per layout to resolve", async () => {
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
    expect(measuredAfter).toBe(slideStarts.length + 2)
    expect(pauses).toBe(slideStarts.length * 2 + 2)
    expect(readLayoutPictures(sliced, wide, undefined)).toBe(warmed)
  })
})

import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { guides, piece, pieces, style } from "./index.js"

type Text = { readonly chars: string; readonly spans: readonly { readonly end: number }[] }
type Spot = { readonly x: number; readonly y: number }

const piecesDir = fileURLToPath(new URL("../files/kit", import.meta.url))
const files = readdirSync(piecesDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -5))
  .sort()

const keysIn = (value: unknown): readonly string[] =>
  typeof value !== "object" || value === null
    ? []
    : Array.isArray(value)
      ? value.flatMap(keysIn)
      : Object.entries(value).flatMap(([key, inner]) => [key, ...keysIn(inner)])

describe("kit pieces", () => {
  it("has every piece a guide names", () => {
    const named = guides().flatMap((entry) => [...entry.markdown.matchAll(/kit\/([a-z0-9-]+)/g)].map((m) => m[1]))
    expect(named.length).toBeGreaterThan(0)
    expect([...new Set(named)].filter((name) => piece(name!) === undefined)).toEqual([])
  })

  it("lists every piece file and opens each one with its size", () => {
    expect(files.length).toBeGreaterThan(0)
    expect(pieces().map((each) => each.name)).toEqual(files)
    for (const name of files) {
      const opened = piece(name)
      const box = (opened?.tree.props as { box?: { w: number; h: number } } | undefined)?.box
      expect(opened?.size).toEqual({ w: box?.w, h: box?.h })
    }
  })

  it("grows each piece into layers Doom accepts", () => {
    for (const each of pieces())
      expect(() => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [each.tree] }] })).not.toThrow()
  })

  it("names only theme colours and text styles, so a piece follows any deck's theme", () => {
    for (const name of files) {
      const raw = readFileSync(`${piecesDir}/${name}.json`, "utf8")
      expect(raw, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(keysIn(JSON.parse(raw)), name).not.toContain("font")
    }
  })

  it("opens nothing outside the pieces", () => {
    expect(piece("missing")).toBeUndefined()
    expect(piece("../package")).toBeUndefined()
    expect(piece("/etc/passwd")).toBeUndefined()
    expect(piece("")).toBeUndefined()
  })
})

const placed: Readonly<Record<string, readonly Spot[]>> = {
  "title-block": [{ x: 120, y: 80 }],
  kpi: [0, 1, 2].map((at) => ({ x: 120 + at * 600, y: 320 })),
  comparison: [{ x: 120, y: 320 }],
  "timeline-step": [0, 1, 2, 3].map((at) => ({ x: 120 + at * 420, y: 360 })),
  "source-line": [{ x: 120, y: 990 }],
  table: [{ x: 120, y: 300 }],
  "bar-chart": [{ x: 120, y: 300 }],
  "column-chart": [{ x: 120, y: 300 }],
  "line-chart": [{ x: 120, y: 300 }],
  "donut-chart": [{ x: 120, y: 300 }],
  "process-flow": [{ x: 120, y: 470 }],
  architecture: [{ x: 120, y: 300 }],
}

const holdsData = new Set(["table", "bar-chart", "column-chart", "line-chart", "donut-chart"])
const aNumber = /^[-−+$€£]?[\d.,]+[%MBKkx]?$/

const doubled = (text: Text, numbersHold: boolean): Text => {
  const chars = text.chars
    .split("\n")
    .map((line) => (numbersHold && aNumber.test(line.replaceAll("**", "").trim()) ? line : `${line} ${line}`))
    .join("\n")
  return {
    ...text,
    chars,
    spans: text.spans.map((span) => (span.end === text.chars.length ? { ...span, end: chars.length } : span)),
  }
}

const longer = (node: doom.TreeNode, numbersHold: boolean): doom.TreeNode => {
  const props = node.props as { text?: Text } | undefined
  return {
    ...node,
    ...(props?.text === undefined ? {} : { props: { ...props, text: doubled(props.text, numbersHold) } as never }),
    children: node.children?.map((child) => longer(child, numbersHold)) ?? [],
  }
}

const at = (tree: doom.TreeNode, spot: Spot): doom.TreeNode => {
  const props = tree.props as { box: Record<string, unknown> }
  return { ...tree, props: { ...props, box: { ...props.box, ...spot } } as never }
}

const runSizes = (all: readonly doom.Resolved[]): readonly number[] =>
  all.flatMap((each) => [
    ...(each.text?.lines.flatMap((line) => line.runs.filter((run) => run.text.trim() !== "").map((run) => run.size)) ??
      []),
    ...runSizes(each.children),
  ])

describe("every piece in every library theme", () => {
  const estimate = doom.measureWith({})
  const themes = ["consulting", "editorial", "midnight", "neutral", "technical"]

  it("places each piece where a slide uses it", () => {
    expect(Object.keys(placed).sort()).toEqual(files)
  })

  for (const words of ["sample", "twice as long"] as const)
    it(`lays out with ${words} words: nothing spills, overlaps, leaves the slide or reads under 24 px`, () => {
      for (const theme of themes)
        for (const each of pieces()) {
          const tree = words === "sample" ? each.tree : longer(each.tree, holdsData.has(each.name))
          const grown = doom.doomFromTree({
            theme: style(theme)!.theme,
            slides: [{ children: placed[each.name]!.map((spot) => at(tree, spot)) }],
          })
          const slide = grown.slides[0]!
          const where = `${each.name} in ${theme}`
          const problems = doom.layoutProblems(grown.doom, [slide], estimate)
          expect(
            problems.filter((problem) => words === "sample" || problem.code !== "lone-word"),
            where,
          ).toEqual([])
          expect(Math.min(...runSizes(doom.resolveSlide(grown.doom, slide, estimate))), where).toBeGreaterThanOrEqual(
            24,
          )
        }
    })
})

type Line = { readonly start: { readonly node?: doom.NodeId }; readonly end: { readonly node?: doom.NodeId } }

const linesOf = (grown: doom.Grown) =>
  [...grown.doom.nodes.values()].flatMap((node) => {
    const geometry = doom.propOf(node, "geometry")
    return geometry?.kind === "line" ? [{ node, geometry: geometry as Line }] : []
  })

describe("diagram pieces", () => {
  const diagrams = ["architecture", "process-flow"]

  it("attach both ends of every connector to the box their piece names", () => {
    for (const name of diagrams) {
      const raw = JSON.parse(readFileSync(`${piecesDir}/${name}.json`, "utf8")) as doom.TreeNode
      const named = (raw.children ?? []).flatMap((child) => {
        const ends = (child.props as { geometry?: { start?: { layer?: string }; end?: { layer?: string } } })?.geometry
        return ends?.start?.layer === undefined ? [] : [[ends.start.layer, ends.end?.layer]]
      })
      const grown = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [piece(name)!.tree] }] })
      const lines = linesOf(grown)
      expect(lines.length, name).toBeGreaterThan(1)
      expect(
        lines.map(({ geometry }) =>
          [geometry.start, geometry.end].map((end) =>
            end.node === undefined ? undefined : doom.propOf(grown.doom.nodes.get(end.node), "name"),
          ),
        ),
        name,
      ).toEqual(named)
    }
  })

  it("keep a connector on its box when the box moves", () => {
    const tree = piece("architecture")!.tree
    const grow = (node: doom.TreeNode) =>
      doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [node] }] })
    const estimate = doom.measureWith({})
    const ends = (grown: doom.Grown) => {
      const flat = (all: readonly doom.Resolved[]): readonly doom.Resolved[] =>
        all.flatMap((each) => [each, ...flat(each.children)])
      return flat(doom.resolveSlide(grown.doom, grown.slides[0]!, estimate)).flatMap((each) => {
        const geometry = each.geometry as {
          readonly kind: string
          readonly to?: { readonly x: number; readonly y: number }
        } | null
        return geometry?.kind === "line" ? [{ x: each.box.x + geometry.to!.x, y: each.box.y + geometry.to!.y }] : []
      })
    }
    const moved: doom.TreeNode = {
      ...tree,
      children: tree.children!.map((child) => {
        if (child.name !== "Ledger") return child
        const props = child.props as { box: { x: number } }
        return { ...child, props: { ...props, box: { ...props.box, x: props.box.x + 120 } } as never }
      }),
    }
    const before = ends(grow(tree))
    const after = ends(grow(moved))
    const shifted = after.filter((end, at) => end.x !== before[at]!.x)
    expect(shifted.length).toBe(1)
    expect(shifted[0]!.x - before[after.indexOf(shifted[0]!)]!.x).toBe(120)
  })
})

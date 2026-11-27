import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { guides, piece, pieces, problemRules, style } from "./index.js"
import { testTheme } from "@airdesign/doom/testing"

type Text = { readonly chars: string; readonly spans: readonly { readonly end: number }[] }
type Spot = { readonly x: number; readonly y: number }

const piecesDir = fileURLToPath(new URL("../files/kit", import.meta.url))
const files = readdirSync(piecesDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -5))
  .sort()

const layerNames = (node: doom.TreeNode): readonly string[] => [
  ...(node.name === undefined ? [] : [node.name]),
  ...(node.children ?? []).flatMap(layerNames),
]

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
      expect(() => doom.doomFromTree({ theme: testTheme, slides: [{ children: [each.tree] }] })).not.toThrow()
  })

  it("names only theme colours and text styles, so a piece follows any deck's theme", () => {
    for (const name of files) {
      const raw = readFileSync(`${piecesDir}/${name}.json`, "utf8")
      expect(raw, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(keysIn(JSON.parse(raw)), name).not.toContain("font")
    }
  })

  it("lists the structural pieces in the kit guide, and each names only layers its piece holds", () => {
    const lines = (guides().find((entry) => entry.name === "kit")?.markdown ?? "").split("\n").flatMap((line) => {
      const named = /^- `kit\/([a-z0-9-]+)`/.exec(line)
      return named === null ? [] : [{ name: named[1]!, line }]
    })
    expect(lines.map((each) => each.name).sort()).toEqual([
      "comparison",
      "cover",
      "driver-equation",
      "kpi",
      "numbered-callout",
      "qa-plan-table",
      "section-tracker",
      "share-box",
      "source-line",
      "statement",
      "timeline-step",
      "title-block",
      "two-by-two",
    ])
    expect(files).toEqual(lines.map((each) => each.name).sort())
    for (const { name, line } of lines) {
      const layers = [...line.matchAll(/`([A-Z][A-Za-z0-9 ]*)`/g)].map((m) => m[1]!)
      expect(layers.length, name).toBeGreaterThan(0)
      expect(
        layers.filter((layer) => !layerNames(piece(name)!.tree).includes(layer)),
        name,
      ).toEqual([])
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
  cover: [{ x: 120, y: 320 }],
  statement: [{ x: 120, y: 320 }],
  "two-by-two": [{ x: 120, y: 260 }],
  "driver-equation": [{ x: 120, y: 420 }],
  "numbered-callout": [0, 1, 2].map((at) => ({ x: 1080, y: 300 + at * 200 })),
  "qa-plan-table": [{ x: 120, y: 280 }],
  "share-box": [{ x: 120, y: 470 }],
  "section-tracker": [{ x: 1320, y: 80 }],
}

const doubled = (text: Text): Text => {
  const chars = text.chars
    .split("\n")
    .map((line) => `${line} ${line}`)
    .join("\n")
  return {
    ...text,
    chars,
    spans: text.spans.map((span) => (span.end === text.chars.length ? { ...span, end: chars.length } : span)),
  }
}

const longer = (node: doom.TreeNode): doom.TreeNode => {
  const props = node.props as { text?: Text } | undefined
  return {
    ...node,
    ...(props?.text === undefined ? {} : { props: { ...props, text: doubled(props.text) } as never }),
    children: node.children?.map(longer) ?? [],
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
          const tree = words === "sample" ? each.tree : longer(each.tree)
          const grown = doom.doomFromTree({
            theme: style(theme)!.theme,
            slides: [{ children: placed[each.name]!.map((spot) => at(tree, spot)) }],
          })
          const slide = grown.slides[0]!
          const where = `${each.name} in ${theme}`
          const problems = doom.layoutProblems(grown.doom, [slide], estimate, problemRules)
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

import { themePresetById } from "@airdesign/skills"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { kitPieces, readKitPiece } from "./index.js"

type Text = { readonly chars: string; readonly spans: readonly { readonly end: number }[] }
type Spot = { readonly x: number; readonly y: number }

const piecesDir = fileURLToPath(new URL("../pieces", import.meta.url))
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
  it("lists every piece file and opens each one with its size", () => {
    expect(files.length).toBeGreaterThan(0)
    expect(kitPieces().map((piece) => piece.name)).toEqual(files)
    for (const name of files) {
      const piece = readKitPiece(name)
      const box = (piece?.tree.props as { box?: { w: number; h: number } } | undefined)?.box
      expect(piece?.size).toEqual({ w: box?.w, h: box?.h })
    }
  })

  it("grows each piece into layers Doom accepts", () => {
    for (const piece of kitPieces())
      expect(() => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [piece.tree] }] })).not.toThrow()
  })

  it("names only theme colours and text styles, so a piece follows any deck's theme", () => {
    for (const name of files) {
      const raw = readFileSync(`${piecesDir}/${name}.json`, "utf8")
      expect(raw, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(keysIn(JSON.parse(raw)), name).not.toContain("font")
    }
  })

  it("opens nothing outside the pieces", () => {
    expect(readKitPiece("missing")).toBeUndefined()
    expect(readKitPiece("../package")).toBeUndefined()
    expect(readKitPiece("/etc/passwd")).toBeUndefined()
    expect(readKitPiece("")).toBeUndefined()
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
        for (const piece of kitPieces()) {
          const tree = words === "sample" ? piece.tree : longer(piece.tree, holdsData.has(piece.name))
          const grown = doom.doomFromTree({
            theme: themePresetById(theme)!.theme,
            slides: [{ children: placed[piece.name]!.map((spot) => at(tree, spot)) }],
          })
          const slide = grown.slides[0]!
          const where = `${piece.name} in ${theme}`
          expect(doom.layoutFindings(grown.doom, [slide], estimate), where).toEqual([])
          expect(Math.min(...runSizes(doom.resolveSlide(grown.doom, slide, estimate))), where).toBeGreaterThanOrEqual(
            24,
          )
        }
    })
})

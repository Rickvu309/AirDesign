import { formatCopy } from "@/copy/format-copy"
import { describe, expect, it } from "vitest"
import { elementId } from "@airdesign/document"
import { selectionColors, replaceSelectionColor } from "./selection-colors"

const node = elementId("1.2")
const palette = { theme: [], deck: [] }
const fields = {
  "fills.p0": {
    value: {
      gradient: {
        stops: [
          { pos: 0, color: { rgb: "000000" } },
          { pos: 100000, color: { rgb: "FFFFFF" } },
        ],
      },
    },
    own: true,
  },
  "border.fill": { value: { solid: { rgb: "000000" } }, own: true },
  "effects.shadow": { value: { outer: { color: { rgb: "000000" }, blur: 100 } }, own: true },
}

describe("selection colors", () => {
  it("lists distinct colors darkest first across gradients, lines and effects", () => {
    expect(selectionColors([{ node, fields }], palette).map((row) => row.hex)).toEqual(["000000", "FFFFFF"])
  })
  it("replaces every matching color while keeping other fields and each occurrence's alpha", () => {
    const sources = [
      {
        node,
        fields: {
          ...fields,
          "text.color": { value: { rgb: "000000", transforms: [{ op: "alpha", val: 50000 }] }, own: true },
        },
      },
    ]
    const changes = replaceSelectionColor(sources, "000000", { rgb: "FF0000" }, palette)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      target: { node },
      border: { fill: { solid: { rgb: "FF0000" } } },
      effects: { shadow: { outer: { color: { rgb: "FF0000" }, blur: 100 } } },
      text: { color: { rgb: "FF0000", transforms: [{ op: "alpha", val: 50000 }] } },
    })
    expect(JSON.stringify(changes)).toContain('"FFFFFF"')
    expect(fields["border.fill"].value.solid.rgb).toBe("000000")
  })
  it("replaces matching rich text runs without changing other run colors or formatting", () => {
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "Black", bold: true, color: { rgb: "000000" } },
          { from: 1, text: "White", color: { rgb: "FFFFFF" } },
        ],
      },
    ]
    const sources = [{ node, fields: { "text.value": { value, own: true } } }]
    const [change] = replaceSelectionColor(sources, "000000", { rgb: "FF0000" }, palette)
    expect(change?.text?.value).toBe(
      JSON.stringify([
        { from: 0, runs: [{ from: 0, text: "Black", bold: true, color: { rgb: "FF0000" } }, value[0]?.runs[1]] },
      ]),
    )
  })
  it("lists inherited text colors without writing them when another color changes", () => {
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "Black", color: { rgb: "000000" } },
          { from: 1, text: "Inherited" },
        ],
      },
    ]
    const sources = [{ node, textColor: { rgb: "FFFFFF" }, fields: { "text.value": { value, own: true } } }]
    expect(selectionColors(sources, palette).map((row) => row.hex)).toEqual(["000000", "FFFFFF"])
    const [change] = replaceSelectionColor(sources, "000000", { rgb: "FF0000" }, palette)
    expect(change?.text?.value).toBe(
      JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Black", color: { rgb: "FF0000" } }, value[0]?.runs[1]] }]),
    )
  })
  it("uses each painted run color when the opening value carries only text", () => {
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "White" },
          { from: 1, text: "Black" },
        ],
      },
    ]
    const sources = [
      {
        node,
        textColor: { rgb: "000000" },
        textColors: (_p: number, r: number) => ({ rgb: r === 0 ? "FFFFFF" : "000000" }),
        fields: { "text.value": { value, own: true } },
      },
    ]
    expect(selectionColors(sources, palette).map((row) => row.hex)).toEqual(["000000", "FFFFFF"])
    const [change] = replaceSelectionColor(sources, "FFFFFF", { rgb: "FF0000" }, palette)
    expect(change?.text?.value).toBe(
      JSON.stringify([{ from: 0, runs: [{ from: 0, text: "White", color: { rgb: "FF0000" } }, value[0]?.runs[1]] }]),
    )
  })
  it("changes matching text gradient stops and preserves the other runs", () => {
    const gradient = {
      stops: [
        { pos: 0, color: { rgb: "000000" } },
        { pos: 100000, color: { rgb: "FFFFFF" } },
      ],
      shade: { linear: { angle: 0, scaled: false } },
      rotateWithShape: false,
    }
    const untouched = { from: 1, text: "Green", color: { rgb: "00FF00" } }
    const painted = { from: 0, text: "Gradient", fill: { gradient } }
    const [change] = replaceSelectionColor(
      [
        {
          node,
          textColor: { rgb: "FFFFFF" },
          fields: { "text.value": { value: [{ from: 0, runs: [painted, untouched] }], own: true } },
        },
      ],
      "000000",
      { rgb: "FF0000" },
      palette,
    )
    expect(JSON.parse(change?.text?.value ?? "null")).toEqual([
      {
        from: 0,
        runs: [
          {
            ...painted,
            fill: { gradient: { ...gradient, stops: [{ pos: 0, color: { rgb: "FF0000" } }, gradient.stops[1]] } },
          },
          untouched,
        ],
      },
    ])
  })

  it("deduplicates theme and rgb colors that paint alike and replaces only the chosen scope", () => {
    const themed = {
      theme: [{ scheme: "accent1" as const, css: `#${"000000"}`, name: formatCopy.colors.accent1 }],
      deck: [],
    }
    const sources = [
      {
        node,
        fields: {
          "fills.p0": { value: { solid: { scheme: "accent1" } }, own: false },
          "border.fill": fields["border.fill"],
        },
      },
    ]
    expect(selectionColors(sources, themed)).toHaveLength(1)
    expect(replaceSelectionColor(sources, "FFFFFF", { rgb: "FF0000" }, themed)).toEqual([])
  })
})

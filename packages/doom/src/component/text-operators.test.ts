import { describe, expect, it } from "vitest"
import { defaultTheme, fontFace, isRefusal, measureWith } from "../index.js"
import { type ComponentInput, expandComponent, readComponentSpec } from "./index.js"

const measure = measureWith({
  [fontFace("Inter", false, false)]: { ascent: 0.8, descent: 0.2, advances: { W: 1, i: 0.25 } },
})
const base = { data: {}, frame: { x: 0, y: 0, w: 1000, h: 1000 }, theme: defaultTheme, measure }
const rect = { kind: "rect", key: ["list", "r"], x: 0, y: 0, w: 1, h: 1, fill: defaultTheme.colors.text }
function run(parts: readonly unknown[], bindings: unknown = [], input: ComponentInput = base) {
  const spec = readComponentSpec({ version: 1, name: "Text", collections: {}, let: bindings, parts })
  if (isRefusal(spec)) throw new Error(JSON.stringify(spec))
  return expandComponent(spec, input)
}

describe("text operators", () => {
  it("gets the natural width from the supplied fit measure, including the requested size", () => {
    const tree = run([{ emit: { ...rect, w: ["textWidth", "Wii", "caption", 20] } }])
    if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
    expect(tree.children[0]?.props.box.w).toBe(30)
  })

  it("charges work before calling the measure, including when called outside emission", () => {
    let probes = 0
    const counted: ComponentInput["measure"] = (...args) => {
      probes += 1
      return measure(...args)
    }
    const items = ["list", ...Array.from({ length: 64 }, () => "W".repeat(500))]
    const widths = ["map", items, "item", ["textWidth", ["get", "item"], "caption"]]
    expect(
      run(
        [],
        [
          ["one", widths],
          ["two", widths],
        ],
        { ...base, measure: counted },
      ),
    ).toMatchObject({ refused: "limit" })
    expect(probes).toBeGreaterThan(0)
    expect(probes).toBeLessThan(80)
  })

  const items = ["list", { chars: "WW", id: "a" }, { chars: "ii", id: "b" }, { chars: "WW", id: "c" }]
  function flow(width: number, source: unknown = items) {
    return run(
      [
        {
          repeat: { over: ["get", "flow.items"], as: "placed" },
          emit: {
            ...rect,
            key: ["list", "r", ["get", "placed.item.id"]],
            x: ["get", "placed.x"],
            y: ["get", "placed.row"],
            w: ["get", "placed.w"],
            h: ["get", "flow.size"],
          },
        },
      ],
      [
        [
          "flow",
          ["flowText", source, { width, rows: 2, rowHeight: 36, leading: 10, gap: 5, style: "caption", smaller: 16 }],
        ],
      ],
    )
  }

  it("packs measured item widths and wraps before reducing the size", () => {
    const tree = flow(100)
    if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
    expect(
      tree.children.map(
        ({
          props: {
            box: { x, y, w, h },
          },
        }) => [x, y, w, h],
      ),
    ).toEqual([
      [0, 0, 48, 24],
      [63, 0, 12, 24],
      [0, 1, 48, 24],
    ])
    expect(tree.findings).toEqual([])
  })

  it("shrinks the whole flow, then skips whole invalid items in input order", () => {
    const tree = flow(45, [...items, { chars: "two\nlines", id: "d" }, { chars: " ", id: "e" }])
    if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
    expect(tree.children.map(({ key, props }) => [key[1], props.box.h])).toEqual([
      ["a", 16],
      ["b", 16],
    ])
    expect(tree.findings).toEqual([expect.objectContaining({ kind: "flow-omitted", omitted: [2, 3, 4] })])
  })

  it("lets a whole display tick step use zero decimals", () => {
    const { fill: _fill, ...box } = rect
    const tickStep = 1000
    const options = {
      scale: 1000,
      digits: ["if", ["isInteger", ["div", tickStep, 1000]], 0, 2],
      prefix: "",
      suffix: "",
      sign: "negative",
    }
    const tree = run([
      {
        emit: {
          ...box,
          kind: "text",
          chars: ["format", tickStep, options],
          style: "caption",
          color: defaultTheme.colors.text,
          align: "left",
          alignV: "top",
        },
      },
    ])
    if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
    expect(tree.children[0]?.props.text?.chars).toBe("1")
  })
})

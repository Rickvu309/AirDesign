import { describe, expect, it } from "vitest"
import { componentSpec } from "./library.js"
import { ends, expand, keyed, role } from "./testing/diagram-tree.js"

const frame = { x: 160, y: 220, w: 1600, h: 720 }

function spec(id: string) {
  const found = componentSpec(id)
  if (found === undefined) throw new Error(`Missing template ${id}`)
  return found
}

describe("consulting frameworks", () => {
  it("places labeled items in their quadrant and emphasizes only the chosen quadrant", () => {
    const tree = expand(spec("matrix"), {
      frame,
      tokens: { focus: "upper-right", sizeLabel: "Revenue" },
      data: {
        axes: [
          { id: "x", label: "Current size" },
          { id: "y", label: "Future growth" },
        ],
        quadrants: [
          { id: "upper-left", label: "Nurture" },
          { id: "upper-right", label: "Invest" },
          { id: "lower-left", label: "Automate" },
          { id: "lower-right", label: "Maintain" },
        ],
        items: [
          { id: "a", label: "Alpha", quadrant: "upper-left", size: 100 },
          { id: "b", label: "Beta", quadrant: "upper-right", size: 900 },
        ],
      },
    })
    expect(keyed(tree, "size-key").props.text?.chars).toBe("Bubble size: Revenue")
    expect(role(tree, "axis")).toHaveLength(2)
    expect(role(tree, "quadrant")).toHaveLength(4)
    expect(keyed(tree, "item", "a").props.box.x).toBeLessThan(keyed(tree, "item", "b").props.box.x)
    expect(keyed(tree, "dot", "b").props.box.w / keyed(tree, "dot", "a").props.box.w).toBeCloseTo(3)
    expect(keyed(tree, "quadrant", "upper-right").props.text?.spans[0]?.color).toEqual({ var: "accent1" })
    expect(tree.findings).toEqual([])
  })

  it("asks for sizes on every matrix item when only some are sized", () => {
    const matrix = spec("matrix")
    const sample = matrix.sample
    if (sample === undefined) throw new Error("Missing matrix sample")
    const tree = expand(matrix, {
      frame,
      data: {
        ...sample.data,
        items: [
          { id: "a", label: "Alpha", quadrant: "upper-left", size: 15 },
          { id: "b", label: "Beta", quadrant: "upper-right" },
        ],
      },
    })
    expect(tree.findings).toContainEqual(expect.objectContaining({ code: "partial-sizes" }))
  })

  it.each(["matrix", "tree"])("uses default colours and reports an unknown %s focus", (id) => {
    const template = spec(id)
    if (template.sample === undefined) throw new Error("Missing template sample")
    const input = { frame, data: template.sample.data }
    const standard = expand(template, input)
    if (id === "matrix") expect(role(standard, "size-key")).toHaveLength(0)
    const unknown = expand(template, { ...input, tokens: { focus: "missing" } })
    expect(unknown.children).toEqual(standard.children)
    expect(unknown.findings).toEqual([
      expect.objectContaining({ kind: "advice", code: "focus-missing" }),
      ...standard.findings,
    ])
  })

  it("suggests splitting a 32-leaf tree when its cards cannot fit realistic labels", () => {
    let parents = [{ id: "root", label: "Why did revenue fall?" }]
    const nodes = [...parents]
    for (const count of [2, 4, 4]) {
      parents = parents.flatMap(({ id }) =>
        Array.from({ length: count }, (_, index) => ({
          id: `${id}-${index}`,
          parent: id,
          label: "…in the recurring revenue segment",
        })),
      )
      nodes.push(...parents)
    }
    const tree = expand(spec("tree"), { frame, data: { nodes } })
    expect(tree.findings).toContainEqual(
      expect.objectContaining({ code: "many-leaves", note: "Move a branch to its own slide." }),
    )
    expect(tree.findings).toContainEqual(expect.objectContaining({ kind: "text-fit" }))
  })

  it("keeps all issue nodes and offers fixes for wide, deep and overflowing branches", () => {
    const nodes = [
      { id: "root", label: "Demand fell" },
      ...Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, parent: "root", label: "…in one segment" })),
      { id: "a", parent: "s0", label: "…as trials declined" },
      { id: "b", parent: "a", label: "…on mobile" },
      { id: "c", parent: "b", label: "W".repeat(120) },
    ]
    const tree = expand(spec("tree"), { frame, data: { nodes }, tokens: { focus: "c" } })
    expect(role(tree, "node")).toHaveLength(nodes.length)
    const root = keyed(tree, "node", "root")
    const branch = keyed(tree, "node", "s0")
    const focused = keyed(tree, "connector", "s0")
    const muted = keyed(tree, "connector", "s1")
    expect(ends(focused)).toEqual({
      start: { node: root.id, site: "r" },
      end: { node: branch.id, site: "l" },
      route: "elbow",
    })
    const leaf = keyed(tree, "node", "a")
    expect(branch.props.box.x - root.props.box.x - root.props.box.w).toBeCloseTo(
      leaf.props.box.x - branch.props.box.x - branch.props.box.w,
    )
    expect(focused.props.stroke).toMatchObject({ weight: 5 })
    expect(muted.props.stroke).toMatchObject({ weight: 2 })
    expect(focused.props.strokes).toEqual([{ kind: "solid", color: { var: "accent1" } }])
    expect(muted.props.strokes).toEqual([{ kind: "solid", color: { var: "text2" } }])
    expect(tree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "advice", code: "many-children" }),
        expect.objectContaining({ kind: "advice", code: "many-levels" }),
        expect.objectContaining({ kind: "text-fit", key: ["node", "c"] }),
      ]),
    )
    expect(keyed(tree, "node", "c").props.text?.chars).toBe("W".repeat(120))
  })
})

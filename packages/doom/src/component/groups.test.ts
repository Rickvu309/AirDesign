import { describe, expect, it } from "vitest"
import { defaultTheme, isRefusal, measureWith } from "../index.js"
import { expandComponent, readComponentSpec, type ComponentNode, type PartKey } from "./index.js"
import { landTree } from "./testing/land-tree.js"

const inputs = { frame: { x: 0, y: 0, w: 400, h: 200 }, theme: defaultTheme, measure: measureWith({}) }
const read = (raw: unknown) => {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(JSON.stringify(spec))
  return spec
}
const expand = (raw: unknown) => {
  const tree = expandComponent(read(raw), { ...inputs, data: {} })
  if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
  return tree
}
const part = (nodes: readonly ComponentNode[], ...key: PartKey) =>
  nodes.find((node) => node.key.join("/") === key.join("/"))
const specOf = (parts: readonly unknown[]) => ({ version: 1, name: "Fixture", collections: {}, parts })
const rectangle = { kind: "rect", key: ["list", "rectangle"], x: 0, y: 0, w: 1, h: 1, fill: defaultTheme.colors.text }

describe("component groups", () => {
  it("holds a group's layers in one hugging frame placed where its first layer paints", () => {
    const at = (key: string, x: number, y: number, w = 10) => ({
      ...rectangle,
      key: ["list", key, ["get", "card"]],
      x: ["add", x, ["mul", ["get", "i"], 100]],
      y,
      w,
      h: 10,
    })
    const raw = specOf([
      { emit: { ...rectangle, key: ["list", "back"] } },
      {
        repeat: { over: ["list", "a", "b"], as: "card" },
        group: ["list", "card", ["get", "card"]],
        children: [
          { emit: at("face", 20, 30, 40) },
          {
            group: ["list", "mark", ["get", "card"]],
            children: [{ emit: at("dot", 70, 50) }, { emit: at("tag", 90, 50) }],
          },
          { group: ["list", "lone", ["get", "card"]], children: [{ emit: at("note", 20, 70) }] },
        ],
      },
    ])
    const tree = expand(raw)
    expect(tree.groups.map(({ key, props }) => [key.join("/"), props.box])).toEqual([
      ["card/a", expect.objectContaining({ x: 20, y: 30, w: 80, h: 50 })],
      ["mark/a", expect.objectContaining({ x: 70, y: 50, w: 30, h: 10 })],
      ["card/b", expect.objectContaining({ x: 120, y: 30, w: 80, h: 50 })],
      ["mark/b", expect.objectContaining({ x: 170, y: 50, w: 30, h: 10 })],
    ])
    expect(tree.groups[1]?.group).toBe(tree.groups[0]?.id)
    expect(part(tree.children, "note", "a")?.group).toBe(tree.groups[0]?.id)
    expect(part(tree.children, "dot", "b")?.props.box).toMatchObject({ x: 170, y: 50 })
    const { doom } = landTree(tree)
    const layers = (id: string) => doom.children.get(id as never)?.map((child) => doom.nodes.get(child)?.name)
    expect(layers(tree.id)).toEqual(["back", "card / a", "card / b"])
    expect(layers(tree.groups[0]!.id)).toEqual(["face / a", "mark / a", "note / a"])
    expect(doom.nodes.get(part(tree.children, "dot", "b")!.id)).toMatchObject({ box: { x: 0, y: 0 } })
    expect(doom.nodes.get(tree.groups[3]!.id)).toMatchObject({ box: { x: 50, y: 20 }, sizing: { w: "hug", h: "hug" } })
    const twice = specOf([
      { group: ["list", "g"], children: [] },
      { group: ["list", "g"], children: [] },
    ])
    expect(expandComponent(read(twice), { ...inputs, data: {} })).toMatchObject({
      refused: "shape",
      field: "parts[1].group",
      form: 'Duplicate group key ["g"].',
    })
    const taken = specOf([{ group: ["list", "rectangle"], children: [{ emit: rectangle }] }])
    expect(expandComponent(read(taken), { ...inputs, data: {} })).toMatchObject({
      refused: "shape",
      field: "parts[0].group",
      form: 'Duplicate emitted key ["rectangle"].',
    })
  })
})

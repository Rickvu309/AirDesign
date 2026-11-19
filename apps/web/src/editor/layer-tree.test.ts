import { elementId, type ElementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { layerDrop, layerRange, layerTree, layersUnder, openedFor, shownLayers, type LayerRow } from "./layer-tree"

const id = (shape: number) => elementId(`256.${String(shape)}`)

function row(shape: number, parent: number | null = null, hidden = false): LayerRow {
  return {
    node: id(shape),
    parent: parent === null ? null : id(parent),
    name: `L${String(shape)}`,
    kind: "shape",
    hidden,
    locked: false,
  }
}

const rows = [row(2), row(9), row(3, 9), row(4, 9), row(5)]

it("nests each layer under its parent and lists each level front first", () => {
  const tree = layerTree(rows)
  expect(tree.map((layer) => layer.node)).toEqual([id(5), id(9), id(2)])
  expect(tree[1]?.layers.map((layer) => layer.node)).toEqual([id(4), id(3)])
})

it("lists a layer whose parent is not on the slide at the top level", () => {
  expect(layerTree([row(3, 40)]).map((layer) => [layer.node, layer.parent])).toEqual([[id(3), null]])
})

it("shows a group's layers only while it is open, one level deeper, dimmed under a hidden parent", () => {
  const tree = layerTree([row(2), row(9, null, true), row(3, 9), row(4, 9)])
  expect(shownLayers(tree, new Set()).map((each) => [each.layer.node, each.depth, each.open])).toEqual([
    [id(9), 0, false],
    [id(2), 0, null],
  ])
  const opened = shownLayers(tree, new Set([id(9)]))
  expect(opened.map((each) => [each.layer.node, each.depth, each.open, each.dim])).toEqual([
    [id(9), 0, true, true],
    [id(4), 1, null, true],
    [id(3), 1, null, true],
    [id(2), 0, null, false],
  ])
})

it("opens every group above the given layers", () => {
  const tree = layerTree([row(9), row(12, 9), row(13, 12), row(2)])
  expect([...openedFor(tree, [id(13)])].sort()).toEqual([id(12), id(9)].sort())
  expect([...openedFor(tree, [id(2)])]).toEqual([])
})

it("finds every layer inside the given layers, at any depth", () => {
  const tree = layerTree([row(9), row(12, 9), row(13, 12), row(2)])
  expect([...layersUnder(tree, [id(9)])].sort()).toEqual([id(12), id(13)].sort())
  expect([...layersUnder(tree, [id(12), id(2)])]).toEqual([id(13)])
})

it("takes every shown layer between two clicked layers, in either direction", () => {
  const shown = shownLayers(layerTree(rows), new Set([id(9)]))
  expect(layerRange(shown, id(5), id(3))).toEqual([id(5), id(9), id(4), id(3)])
  expect(layerRange(shown, id(3), id(5))).toEqual([id(5), id(9), id(4), id(3)])
  expect(layerRange(shown, id(77), id(3))).toEqual([id(3)])
})

it("turns a drop above or below a sibling into the layer it now sits before, back first", () => {
  const tree = layerTree([row(2), row(3), row(4)])
  const among: readonly ElementId[] = [id(2), id(3), id(4)]
  expect(layerDrop(tree, id(2), id(4), "above")).toEqual({ node: id(2), before: null, among })
  expect(layerDrop(tree, id(4), id(2), "below")).toEqual({ node: id(4), before: id(2), among })
  expect(layerDrop(tree, id(2), id(4), "below")).toEqual({ node: id(2), before: id(4), among })
  expect(layerDrop(tree, id(4), id(3), "above")).toBeNull()
  expect(layerDrop(tree, id(2), id(3), "below")).toBeNull()
  expect(layerDrop(tree, id(3), id(3), "above")).toBeNull()
})

it("refuses a drop onto a layer with another parent", () => {
  const tree = layerTree(rows)
  expect(layerDrop(tree, id(2), id(3), "above")).toBeNull()
  expect(layerDrop(tree, id(3), id(4), "below")).toBeNull()
  expect(layerDrop(tree, id(3), id(4), "above")).toEqual({ node: id(3), before: null, among: [id(3), id(4)] })
})

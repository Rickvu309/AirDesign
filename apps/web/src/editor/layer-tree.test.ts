import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import {
  layerPlace,
  layerRange,
  layerTree,
  layersUnder,
  openedFor,
  shownLayers,
  type LayerRow,
  type LayerZone,
} from "./layer-tree"

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

const group = (shape: number, parent: number | null = null): LayerRow => ({ ...row(shape, parent), kind: "group" })

const nested = layerTree([row(2), group(9), row(3, 9), row(4, 9), row(5)])
const opened = shownLayers(nested, new Set([id(9)]))
const place = (node: number, target: number, zone: LayerZone, depth?: number) =>
  layerPlace(nested, opened, id(node), id(target), zone, depth)

it("turns a drop above or below a layer into its new parent and the layer it sits behind", () => {
  expect(place(2, 5, "above")).toEqual({ node: id(2), parent: null, before: null, mark: [id(5), "above", 0] })
  expect(place(5, 2, "below")).toEqual({ node: id(5), parent: null, before: id(2), mark: [id(2), "below", 0] })
  expect(place(2, 3, "above")).toEqual({ node: id(2), parent: id(9), before: id(4), mark: [id(3), "above", 1] })
  expect(place(4, 5, "above")).toEqual({ node: id(4), parent: null, before: null, mark: [id(5), "above", 0] })
})

it("drops into a group on its row's middle, or just under its open row, at the front of its layers", () => {
  expect(place(2, 9, "inside")).toEqual({ node: id(2), parent: id(9), before: null, mark: [id(9), "inside", 0] })
  expect(place(5, 9, "below")).toEqual({ node: id(5), parent: id(9), before: null, mark: [id(9), "below", 1] })
  expect(place(5, 2, "inside")).toBeNull()
})

it("lets the pointer's indent choose the level under the last layer of a group", () => {
  expect(place(5, 3, "below", 0)).toEqual({ node: id(5), parent: null, before: id(9), mark: [id(3), "below", 0] })
  expect(place(5, 3, "below", 1)).toEqual({ node: id(5), parent: id(9), before: id(3), mark: [id(3), "below", 1] })
  expect(place(5, 3, "below", 7)).toEqual(place(5, 3, "below", 1))
  expect(place(5, 4, "below", 0)).toEqual({ node: id(5), parent: id(9), before: id(4), mark: [id(4), "below", 1] })
})

it("refuses a drop that changes nothing or puts a group inside itself", () => {
  expect(place(5, 9, "above")).toBeNull()
  expect(place(3, 4, "below")).toBeNull()
  expect(place(9, 4, "above")).toBeNull()
  expect(place(9, 9, "inside")).toBeNull()
})

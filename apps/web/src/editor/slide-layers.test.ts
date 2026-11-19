import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { onSlide, xml } from "@/slide-fixtures"
import { layerTree } from "./layer-tree"
import { slideLayerRows } from "./slide-layers"

const tags = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`

function box(id: number, name: string, extra = "") {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${String(id)}" name="${name}"${extra}/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr></p:sp>`
}

function group(id: number, name: string, inside: string, extra = "") {
  return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${String(id)}" name="${name}"${extra}/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/><a:chOff x="0" y="0"/><a:chExt cx="10" cy="10"/></a:xfrm></p:grpSpPr>${inside}</p:grpSp>`
}

function slide(tree: string) {
  return onSlide(xml(`<p:sld ${tags}><p:cSld><p:spTree>${tree}</p:spTree></p:cSld></p:sld>`))
}

const plain = { kind: "shape" } as const

it("lists a slide's layers front first, with each group's layers nested under it", () => {
  const parts = slide(
    box(2, "Title") +
      group(9, "Card", box(3, "Back") + group(12, "Badge", box(13, "Dot") + box(14, "Ring")) + box(4, "Label")) +
      box(5, "Note"),
  )
  const tree = layerTree(slideLayerRows(parts, "256", () => plain))
  const outline = (layers: typeof tree): unknown =>
    layers.map((layer) => (layer.layers.length === 0 ? layer.name : [layer.name, outline(layer.layers)]))
  expect(outline(tree)).toEqual(["Note", ["Card", ["Label", ["Badge", ["Ring", "Dot"]], "Back"]], "Title"])
  expect(tree[1]?.node).toBe(elementId("256.9"))
  expect(tree[1]?.layers[1]?.parent).toBe(elementId("256.9"))
  expect(tree[0]?.parent).toBeNull()
})

it("keeps a hidden layer in the list and marks it hidden", () => {
  const parts = slide(box(2, "Title") + box(3, "Draft", ' hidden="1"'))
  const tree = layerTree(slideLayerRows(parts, "256", () => plain))
  expect(tree.map((layer) => [layer.name, layer.hidden])).toEqual([
    ["Draft", true],
    ["Title", false],
  ])
})

it("names a layer with no name of its own by its kind, as the design panel does", () => {
  const parts = slide(box(2, "") + box(3, "") + box(4, "Title 1"))
  const tree = layerTree(
    slideLayerRows(parts, "256", (node) => (node === elementId("256.4") ? plain : { kind: "text" })),
  )
  expect(tree.map((layer) => layer.name)).toEqual(["Title 1", "Text 2", "Text 1"])
})

it("leaves out a frame's backdrop, which paints the frame's own fill, and keeps its auto layout's flow", () => {
  const parts = slide(group(9, "Frame", box(10, "Backdrop") + box(11, "Item")))
  const tree = layerTree(
    slideLayerRows(parts, "256", (node) =>
      node === elementId("256.9") ? { kind: "frame", backdrop: elementId("256.10"), flow: "vertical" } : plain,
    ),
  )
  expect(tree.map((layer) => [layer.name, layer.kind, layer.flow, layer.layers.map((each) => each.name)])).toEqual([
    ["Frame", "frame", "vertical", ["Item"]],
  ])
})

it("lists only the layers of the slide it is asked for", () => {
  expect(slideLayerRows(slide(box(2, "Title")), "999", () => plain)).toEqual([])
})

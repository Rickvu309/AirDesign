import { elementId, slideId, writeTextValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { layerCopyHtml, layerText, readLayerCopy, type LayerCopy } from "@/layer-clipboard"

const box = { x: 10, y: 20, cx: 300, cy: 400 }
const title = elementId("256.2")
const value = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Q3 <revenue> & costs" }] }])

const copy: LayerCopy = {
  deck: "deck-1",
  slide: slideId("256"),
  layers: [
    {
      source: title,
      box,
      rows: [{ source: title, element: { node: elementId("256.9"), kind: "shape", value, box, grouped: false } }],
    },
    {
      source: elementId("256.3"),
      box,
      rows: [
        {
          source: elementId("256.3"),
          element: { node: elementId("256.10"), kind: "shape", value: "Second line", box, grouped: false },
        },
      ],
    },
  ],
}

describe("layer clipboard", () => {
  it("reads back the layers it wrote", () => {
    expect(readLayerCopy(layerCopyHtml(copy))).toEqual(copy)
  })

  it("reads back a layer's markup and its images, for a paste in another deck", () => {
    const carried = {
      markup: '<p:pic><a:blip r:embed="pasted0"/></p:pic>',
      images: [{ type: "image/png" as const, data: "iVBORw0KGgo=" }],
    }
    const held: LayerCopy = { ...copy, layers: [{ ...copy.layers[0]!, carried }] }
    expect(readLayerCopy(layerCopyHtml(held))).toEqual(held)
    const odd = {
      ...held,
      layers: [{ ...held.layers[0]!, carried: { ...carried, images: [{ type: "image/bmp", data: "" }] } }],
    }
    expect(readLayerCopy(layerCopyHtml(odd as LayerCopy))).toBeNull()
  })

  it("gives other apps the layers' text", () => {
    expect(layerText(copy)).toBe("Q3 <revenue> & costs\nSecond line")
    expect(layerCopyHtml(copy)).toContain(">Q3 &lt;revenue&gt; &amp; costs<br>Second line</div>")
  })

  it("reads layers from the HTML another browser tab put on the clipboard", () => {
    const html = layerCopyHtml(copy).replace('<meta charset="utf-8">', "<html><body><!--StartFragment-->")
    expect(readLayerCopy(`${html}<!--EndFragment--></body></html>`)).toEqual(copy)
  })

  it("refuses HTML from other apps, a broken copy and a row from another slide", () => {
    expect(readLayerCopy("<p>Hello</p>")).toBeNull()
    expect(readLayerCopy('<div data-airdesign-layers="bm90IGpzb24="></div>')).toBeNull()
    const astray: LayerCopy = {
      ...copy,
      layers: [{ ...copy.layers[0]!, rows: [{ ...copy.layers[0]!.rows[0]!, source: elementId("257.2") }] }],
    }
    expect(readLayerCopy(layerCopyHtml(astray))).toBeNull()
  })
})

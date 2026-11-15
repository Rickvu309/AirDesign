import { elementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasText } from "./index.js"

const text: CanvasText = {
  paragraphs: [
    {
      from: 0,
      align: "left",
      bullet: { char: "•", font: null, color: null, size: null },
      spaceAfter: { length: 10 },
      runs: [{ from: 0, text: "Merged cell", font: "Arial", size: 100, bold: true, italic: false, color: "white" }],
      endStyle: { font: "Arial", size: 100, bold: false, italic: false, color: "white" },
    },
  ],
  anchor: "middle",
  insets: { left: 10, right: 20, top: 30, bottom: 40 },
  wrap: true,
}

it("paints merged cell sizes, fill, borders and the existing text look without an editor or Tab stop", async () => {
  const id = elementId("256.2")
  const line = { color: "white", width: 10, dash: [3, 1] }
  const cell = {
    gridSpan: 2,
    rowSpan: 2,
    hMerge: false,
    vMerge: false,
    fill: "navy",
    text,
    borders: { left: line, right: null, top: null, bottom: line },
  }
  const hidden = { ...cell, gridSpan: 1, rowSpan: 1, hMerge: true }
  const element: CanvasElement = {
    key: "table",
    id,
    kind: "chart",
    box: { x: 100, y: 200, width: 1000, height: 500, rotation: 0, flipH: false, flipV: false },
    editable: false,
    placeholder: false,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    table: {
      columns: [400, 600],
      rows: [
        { height: 200, cells: [cell, hidden] },
        { height: 300, cells: [{ ...hidden, hMerge: false, vMerge: true }, hidden] },
      ],
    },
  }
  const store = paintStore()
  store.publish({ id, kind: "chart", text: "", picture: null })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const edit = vi.fn()
  try {
    await act(async () =>
      root.render(
        createElement(SlideCanvas, {
          store,
          slide: { width: 2000, height: 1000, background: null, elements: [element] },
          width: 1000,
          onEdit: edit,
        }),
      ),
    )
    const table = host.querySelector<HTMLElement>("[data-canvas-table]")
    const painted = table?.querySelector<HTMLElement>("[data-table-cell]")
    expect(table?.style.left).toBe("50px")
    expect(table?.style.background).toBe("")
    expect(table?.getAttribute("contenteditable")).toBe("false")
    expect(table?.querySelectorAll("[data-table-cell]").length).toBe(1)
    expect(table?.style.gridTemplateColumns).toBe("200px 300px")
    expect(table?.style.gridTemplateRows).toBe("minmax(100px, auto) minmax(150px, auto)")
    expect(table?.style.height).toBe("auto")
    expect(painted?.style.gridColumn).toBe("1 / span 2")
    expect(painted?.style.gridRow).toBe("1 / span 2")
    expect(painted?.firstElementChild?.getAttribute("style")).toContain("padding: 15px 10px 20px 5px")
    expect(painted?.style.background).toBe("navy")
    expect(painted?.textContent).toBe("Merged cell")
    expect(painted?.querySelector("span")?.style.fontSize).toBe("50px")
    expect(painted?.querySelector<HTMLElement>("[data-paragraph]")?.style.getPropertyValue("--bullet")).toBe('"•"')
    expect(painted?.querySelector("line")?.getAttribute("stroke")).toBe("white")
    expect(painted?.querySelector("line")?.getAttribute("stroke-dasharray")).toBe("15 5")
    expect(host.querySelectorAll('[contenteditable="true"],[tabindex="0"]').length).toBe(0)
    expect(edit).not.toHaveBeenCalled()
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})

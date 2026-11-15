import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import {
  paintStore,
  SlideCanvas,
  type CanvasElement,
  type CanvasRunStyle,
  type CanvasSlide,
  type CanvasText,
  type PaintBox,
} from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const wide = { width: 12_192_000, height: 6_858_000, background: null }
const place: PaintBox = {
  x: 1_219_200,
  y: 685_800,
  width: 6_096_000,
  height: 1_714_500,
  rotation: 0,
  flipH: false,
  flipV: false,
}

function written(id: ElementId, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    key: id,
    id,
    kind: "shape",
    box: place,
    editable: false,
    placeholder: false,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    ...overrides,
  }
}

async function canvas(
  slide: CanvasSlide,
  width = 800,
  text = "words",
  onEdit?: (id: ElementId, value: string) => void,
  store = paintStore(),
) {
  for (const element of slide.elements) {
    if (element.id !== null)
      store.publish({ id: element.id, kind: element.kind, text, picture: element.kind === "picture" ? "" : null })
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide, width, ...(onEdit === undefined ? {} : { onEdit }) }))
  })
  return host
}

function placed(host: HTMLElement, key: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-canvas-element="${key}"]`)
  if (found === null) throw new Error(`no element ${key}`)
  return found
}

function surface(host: HTMLElement): HTMLElement {
  const found = host.querySelector<HTMLElement>("[data-slide-paint]")
  if (found === null) throw new Error("no canvas")
  return found
}

describe("SlideCanvas", () => {
  const id = elementId("256.2")

  it("sizes the canvas to the given width at the deck's aspect ratio", async () => {
    const host = await canvas({ width: 9_144_000, height: 6_858_000, background: null, elements: [] })
    expect(surface(host).style.width).toBe("800px")
    expect(surface(host).style.height).toBe("600px")
  })

  it("places an element by its box scaled on both axes by width over slide width", async () => {
    const host = await canvas({ ...wide, elements: [written(id)] }, 640)
    const element = placed(host, id)
    expect(element.style.position).toBe("absolute")
    expect(element.style.left).toBe("64px")
    expect(element.style.top).toBe("36px")
    expect(element.style.width).toBe("320px")
    expect(element.style.height).toBe("90px")
  })

  it("keeps a tall slide's vertical positions on the width scale", async () => {
    const host = await canvas({ width: 6_858_000, height: 12_192_000, background: null, elements: [written(id)] }, 343)
    expect(Number.parseFloat(surface(host).style.height)).toBeCloseTo(609.778, 2)
    expect(Number.parseFloat(placed(host, id).style.top)).toBeCloseTo(34.3, 2)
    expect(Number.parseFloat(placed(host, id).style.left)).toBeCloseTo(60.978, 2)
  })

  it("scales the default text size with the canvas", async () => {
    const full = await canvas({ ...wide, elements: [] }, 800)
    const half = await canvas({ ...wide, elements: [] }, 400)
    expect(Number.parseFloat(full.querySelector<HTMLElement>("[data-slide-paint]")?.style.fontSize ?? "")).toBeCloseTo(
      13.333,
      2,
    )
    expect(Number.parseFloat(half.querySelector<HTMLElement>("[data-slide-paint]")?.style.fontSize ?? "")).toBeCloseTo(
      6.667,
      2,
    )
  })

  it("turns an element by its rotation and flips", async () => {
    const box = { ...place, rotation: 90, flipH: true }
    const host = await canvas({ ...wide, elements: [written(id, { box })] })
    expect(placed(host, id).style.transform).toBe("rotate(90deg) scale(-1, 1)")
  })

  it("leaves an unturned element without a transform", async () => {
    const host = await canvas({ ...wide, elements: [written(id)] })
    expect(placed(host, id).style.transform).toBe("")
  })

  it.each([
    [true, false, "scaleX(-1)"],
    [false, true, "scaleX(-1)"],
    [true, true, ""],
    [false, false, ""],
  ])("keeps text readable when flipH is %s and flipV is %s", async (flipH, flipV, undo) => {
    const host = await canvas({ ...wide, elements: [written(id, { box: { ...place, flipH, flipV } })] })
    const text = placed(host, id).firstElementChild
    if (!(text instanceof HTMLElement)) throw new Error("no text layer")
    expect(text.style.transform).toBe(undo)
  })

  it("paints elements in the order given", async () => {
    const first = elementId("256.3")
    const host = await canvas({ ...wide, elements: [written(id), written(first)] })
    const painted = [...surface(host).querySelectorAll<HTMLElement>("[data-canvas-element]")]
    expect(painted.map((each) => each.dataset.canvasElement)).toEqual([id, first])
  })

  it("makes only an editable element take the pointer and the caret", async () => {
    const other = elementId("256.3")
    const host = await canvas(
      { ...wide, elements: [written(id, { editable: true }), written(other)] },
      800,
      "words",
      () => undefined,
    )
    expect(placed(host, id).style.pointerEvents).toBe("auto")
    expect(placed(host, id).querySelector('[contenteditable="true"]')).not.toBeNull()
    expect(placed(host, other).style.pointerEvents).toBe("none")
    expect(placed(host, other).querySelector('[contenteditable="true"]')).toBeNull()
  })

  it.each([
    ["no text", ""],
    ["only spaces", "   "],
    ["paragraphs with no runs", '[{"from":0,"runs":[]},{"from":1,"runs":[]}]'],
    ["runs of only spaces", '[{"from":0,"runs":[{"from":0,"text":"  "}]}]'],
  ])("lets the pointer through an empty box with %s and keeps its caret", async (_name, text) => {
    const host = await canvas({ ...wide, elements: [written(id, { editable: true })] }, 800, text, () => undefined)
    expect(placed(host, id).style.pointerEvents).toBe("none")
    expect(placed(host, id).querySelector('[contenteditable="true"]')).not.toBeNull()
  })

  it("keeps the pointer on an empty placeholder", async () => {
    const element = written(id, { editable: true, placeholder: true })
    const host = await canvas({ ...wide, elements: [element] }, 800, "", () => undefined)
    expect(placed(host, id).style.pointerEvents).toBe("auto")
  })

  it("keeps the pointer on an empty box with a visible fill", async () => {
    const element = written(id, { editable: true, filled: true })
    const host = await canvas({ ...wide, elements: [element] }, 800, "", () => undefined)
    expect(placed(host, id).style.pointerEvents).toBe("auto")
  })

  it("keeps the pointer on an empty box with no place on the slide, since it covers nothing", async () => {
    const element = written(id, { editable: true, box: null })
    const host = await canvas({ ...wide, elements: [element] }, 800, "", () => undefined)
    expect(placed(host, id).style.pointerEvents).toBe("auto")
  })

  it("does not give the pointer to a placeholder that cannot be edited", async () => {
    const host = await canvas({ ...wide, elements: [written(id, { placeholder: true })] }, 800, "")
    expect(placed(host, id).style.pointerEvents).toBe("none")
  })

  it("gives the pointer to an empty box once it has text and takes it back when the text goes", async () => {
    const store = paintStore()
    const host = await canvas({ ...wide, elements: [written(id, { editable: true })] }, 800, "", () => undefined, store)
    const publish = async (text: string) => {
      await act(async () => {
        store.publish({ id, kind: "shape", text, picture: null })
      })
    }
    await publish("typed")
    expect(placed(host, id).style.pointerEvents).toBe("auto")
    await publish("")
    expect(placed(host, id).style.pointerEvents).toBe("none")
  })

  it("reports an edit against the element that was typed in", async () => {
    const edits: string[] = []
    const host = await canvas(
      { ...wide, elements: [written(id, { editable: true })] },
      800,
      "words",
      (target, value) => {
        edits.push(`${target} ${value}`)
      },
    )
    const box = placed(host, id).querySelector<HTMLElement>('[contenteditable="true"]')
    if (box === null) throw new Error("no box")
    box.querySelector("[data-run]")?.append("!")
    await act(async () => {
      box.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(edits).toHaveLength(1)
    expect(edits[0]).toContain(id)
    expect(edits[0]).toContain("words!")
  })

  it("paints a sheet element with no document id as an empty box", async () => {
    const host = await canvas({
      ...wide,
      elements: [
        {
          key: "ppt/slideLayouts/slideLayout1.xml#7",
          id: null,
          kind: "shape",
          box: place,
          editable: false,
          placeholder: false,
          filled: false,
          fill: null,
          line: null,
          outline: "box",
          text: null,
        },
      ],
    })
    const element = placed(host, "ppt/slideLayouts/slideLayout1.xml#7")
    expect(element.style.width).toBe("400px")
    expect(element.childElementCount).toBe(0)
  })

  it("marks a picture and a chart it cannot show yet as an empty box", async () => {
    const chart = elementId("256.3")
    const shape = elementId("256.4")
    const host = await canvas({
      ...wide,
      elements: [written(id, { kind: "picture" }), written(chart, { kind: "chart" }), written(shape)],
    })
    expect(placed(host, id).style.background).not.toBe("")
    expect(placed(host, chart).style.background).not.toBe("")
    expect(placed(host, shape).style.background).toBe("")
  })

  it("keeps an element with no box on the canvas in the flow of the slide", async () => {
    const host = await canvas({ ...wide, elements: [written(id, { box: null })] })
    expect(placed(host, id).style.position).toBe("")
    expect(placed(host, id).textContent).toBe("words")
  })

  it("carries the class it is given onto the slide", async () => {
    const store = paintStore()
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    hosts.push({ host, root })
    await act(async () => {
      root.render(
        createElement(SlideCanvas, { store, slide: { ...wide, elements: [] }, width: 800, className: "framed" }),
      )
    })
    expect(surface(host).className).toBe("framed")
  })
})

const styled = (size: number, color: string | null, font: string | null = "Serifa"): CanvasRunStyle => ({
  font,
  size,
  bold: false,
  italic: false,
  color,
})

const twoRuns: CanvasText = {
  paragraphs: [
    {
      from: 0,
      align: "center",
      runs: [
        { from: 0, text: "big", ...styled(508_000, "rgb(1, 2, 3)") },
        { from: 1, text: "small", ...styled(254_000, "rgb(4, 5, 6)", null), bold: true, italic: true },
      ],
      endStyle: styled(127_000, "rgb(7, 8, 9)"),
    },
  ],
  anchor: "bottom",
  insets: { left: 12_192, top: 24_384, right: 36_576, bottom: 48_768 },
  wrap: true,
}

function runNode(host: HTMLElement, name: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-run="${name}"]`)
  if (found === null) throw new Error(`no run ${name}`)
  return found
}

function value(runs: readonly { from: number; text: string }[]): string {
  return JSON.stringify([{ from: 0, runs }])
}

describe("SlideCanvas style", () => {
  const id = elementId("256.2")

  it("paints the slide with its background and white when it has none", async () => {
    const painted = await canvas({ ...wide, background: "rgb(9, 8, 7)", elements: [] })
    const plain = await canvas({ ...wide, elements: [] })
    expect(painted.querySelector<HTMLElement>("[data-slide-paint]")?.style.background).toBe("rgb(9, 8, 7)")
    expect(plain.querySelector<HTMLElement>("[data-slide-paint]")?.style.background).toBe("white")
  })

  it("paints a fill behind the box and a line around it, each with its own colour", async () => {
    const host = await canvas({
      ...wide,
      elements: [
        written(id, {
          fill: "rgb(10, 20, 30)",
          line: { color: "rgb(40, 50, 60)", width: 152_400, dash: [4, 3] },
        }),
      ],
    })
    expect(placed(host, id).style.background).toBe("rgb(10, 20, 30)")
    const stroke = host.querySelector("[data-canvas-line] rect")
    expect(stroke?.getAttribute("stroke")).toBe("rgb(40, 50, 60)")
    expect(stroke?.getAttribute("stroke-width")).toBe("10")
    expect(stroke?.getAttribute("stroke-dasharray")).toBe("40 30")
    expect(stroke?.getAttribute("width")).toBe("400")
  })

  it("draws a line from corner to corner and an ellipse in its box", async () => {
    const other = elementId("256.3")
    const line = { color: "rgb(1, 1, 1)", width: 12_700, dash: null }
    const host = await canvas({
      ...wide,
      elements: [written(id, { line, outline: "line" }), written(other, { line, outline: "ellipse" })],
    })
    expect(placed(host, id).querySelector("line")?.getAttribute("x2")).toBe("400")
    expect(placed(host, id).querySelector("line")?.getAttribute("y2")).toBe(String((1_714_500 * 800) / 12_192_000))
    expect(placed(host, other).querySelector("ellipse")?.getAttribute("rx")).toBe("200")
    expect(placed(host, other).style.borderRadius).toBe("50%")
  })

  it("scales each run's size with the canvas like the box", async () => {
    const slide = { ...wide, elements: [written(id, { text: twoRuns })] }
    const stored = value([
      { from: 0, text: "big" },
      { from: 1, text: "small" },
    ])
    const sized = async (width: number) =>
      Number.parseFloat(runNode(await canvas(slide, width, stored), "0.0").style.fontSize)
    expect(await sized(800)).toBeCloseTo((508_000 * 800) / 12_192_000, 3)
    expect(await sized(400)).toBeCloseTo((508_000 * 400) / 12_192_000, 3)
  })

  it("styles each run by its offset, not its place in the paragraph", async () => {
    const host = await canvas(
      { ...wide, elements: [written(id, { text: twoRuns })] },
      800,
      value([
        { from: 1, text: "small" },
        { from: 0, text: "big" },
      ]),
    )
    expect(runNode(host, "0.1").textContent).toBe("small")
    expect(runNode(host, "0.1").style.color).toBe("rgb(4, 5, 6)")
    expect(runNode(host, "0.1").style.fontWeight).toBe("700")
    expect(runNode(host, "0.1").style.fontStyle).toBe("italic")
    expect(runNode(host, "0.0").style.color).toBe("rgb(1, 2, 3)")
    expect(runNode(host, "0.0").style.fontWeight).toBe("400")
  })

  it("falls back to the page's font and colour when a run has none", async () => {
    const plain: CanvasText = {
      ...twoRuns,
      paragraphs: [
        {
          from: 0,
          align: "left",
          runs: [{ from: 0, text: "a", ...styled(1, null, null) }],
          endStyle: styled(1, null, null),
        },
      ],
    }
    const host = await canvas(
      { ...wide, elements: [written(id, { text: plain })] },
      800,
      value([{ from: 0, text: "a" }]),
    )
    expect(runNode(host, "0.0").style.color).toBe("black")
    expect(runNode(host, "0.0").style.fontFamily).toBe("var(--font-sans)")
  })

  it("names the file's font first and keeps the page's as the fallback", async () => {
    const host = await canvas(
      { ...wide, elements: [written(id, { text: twoRuns })] },
      800,
      value([{ from: 0, text: "big" }]),
    )
    expect(runNode(host, "0.0").style.fontFamily).toBe('"Serifa", var(--font-sans)')
  })

  it("gives an empty paragraph its end style and a single line", async () => {
    const host = await canvas({ ...wide, elements: [written(id, { text: twoRuns })] }, 800, value([]))
    const block = host.querySelector<HTMLElement>('[data-paragraph="0"]')
    expect(Number.parseFloat(block?.style.fontSize ?? "")).toBeCloseTo((127_000 * 800) / 12_192_000, 3)
    expect(block?.style.color).toBe("rgb(7, 8, 9)")
    expect(block?.style.lineHeight).toBe("1.2")
  })

  it("styles a new run with the end style the export writes it with", async () => {
    const host = await canvas(
      { ...wide, elements: [written(id, { text: twoRuns })] },
      800,
      value([{ from: -1, text: "typed" }]),
    )
    expect(runNode(host, "0.-1").style.color).toBe("rgb(7, 8, 9)")
  })

  it("lets only the runs set the height of a line that has words", async () => {
    const host = await canvas(
      { ...wide, elements: [written(id, { text: twoRuns })] },
      800,
      value([{ from: 0, text: "big" }]),
    )
    expect(host.querySelector<HTMLElement>('[data-paragraph="0"]')?.style.lineHeight).toBe("0")
    expect(runNode(host, "0.0").style.lineHeight).toBe("1.2")
  })

  it("aligns each paragraph and places the words by the box's insets and anchor", async () => {
    const host = await canvas(
      { ...wide, elements: [written(id, { text: twoRuns })] },
      800,
      value([{ from: 0, text: "big" }]),
    )
    expect(host.querySelector<HTMLElement>('[data-paragraph="0"]')?.style.textAlign).toBe("center")
    const layer = placed(host, id).firstElementChild as HTMLElement
    expect(layer.style.padding).toBe("1.6px 2.4px 3.2px 0.8px")
    expect(layer.style.justifyContent).toBe("flex-end")
  })

  it("does not wrap the words of a box that does not wrap", async () => {
    const host = await canvas(
      { ...wide, elements: [written(id, { text: { ...twoRuns, wrap: false } })] },
      800,
      value([{ from: 0, text: "big" }]),
    )
    expect(host.querySelector<HTMLElement>("[data-paragraph]")?.parentElement?.style.whiteSpace).toBe("pre")
  })

  it("paints a sheet element's own words with their style and no caret", async () => {
    const key = "ppt/slideMasters/slideMaster1.xml#4"
    const host = await canvas({
      ...wide,
      elements: [{ ...written(id, { text: twoRuns }), key, id: null }],
    })
    const element = placed(host, key)
    expect(element.textContent).toBe("bigsmall")
    expect(element.querySelector("[contenteditable]")).toBeNull()
    const spans = element.querySelectorAll("span")
    expect(spans[0]?.style.color).toBe("rgb(1, 2, 3)")
    expect(spans[1]?.style.color).toBe("rgb(4, 5, 6)")
  })

  it("keeps each run's style when a later value moves the words", async () => {
    const store = paintStore()
    const host = await canvas(
      { ...wide, elements: [written(id, { text: twoRuns })] },
      800,
      value([
        { from: 0, text: "big" },
        { from: 1, text: "small" },
      ]),
      undefined,
      store,
    )
    await act(async () => {
      store.publish({
        id,
        kind: "shape",
        text: value([
          { from: 0, text: "bigger" },
          { from: 1, text: "sm" },
        ]),
        picture: null,
      })
    })
    expect(runNode(host, "0.0").textContent).toBe("bigger")
    expect(runNode(host, "0.0").style.color).toBe("rgb(1, 2, 3)")
    expect(runNode(host, "0.1").style.color).toBe("rgb(4, 5, 6)")
  })

  it("folds a wrapper the browser adds back into a plain run in the end style", async () => {
    const edits: string[] = []
    const host = await canvas(
      { ...wide, elements: [written(id, { text: twoRuns, editable: true })] },
      800,
      value([{ from: 0, text: "big" }]),
      (_, written) => edits.push(written),
    )
    const box = host.querySelector<HTMLElement>('[contenteditable="true"]')
    const block = box?.querySelector<HTMLElement>('[data-paragraph="0"]')
    if (box === null || box === undefined || block === null || block === undefined) throw new Error("no box")
    const wrapper = document.createElement("span")
    wrapper.style.color = "rgb(200, 0, 0)"
    wrapper.append("x")
    block.append(wrapper)
    await act(async () => {
      box.dispatchEvent(new InputEvent("input", { bubbles: true }))
    })
    expect(edits).toEqual([
      value([
        { from: 0, text: "big" },
        { from: -1, text: "x" },
      ]),
    ])
    expect(runNode(host, "0.-1").style.color).toBe("rgb(7, 8, 9)")
    expect(block.isConnected ? block.querySelector("span:not([data-run])") : null).toBeNull()
  })
})

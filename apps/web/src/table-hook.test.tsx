import { decide, elementId, openRegister, slideId, type Command, type Register } from "@airdesign/document"
import { readShapes } from "@airdesign/pptx"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { elementCommand } from "./element-edit"
import { slideBase } from "./exported-parts"
import { onSlide, twoBoxSlide, xml } from "./slide-fixtures"
import { useTables, type TableDeck } from "./table-hook"

const device = vi.hoisted(() => ({ link: null as unknown }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => device.link,
}))

const deck = "table-deck"
const node = elementId("256.4")
let window: Window & typeof globalThis

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function Tables(props: { readonly deck: TableDeck; readonly exposed: (tables: ReturnType<typeof useTables>) => void }) {
  props.exposed(useTables(props.deck))
  return null
}

async function settled(work: () => void = () => undefined): Promise<void> {
  await act(async () => {
    work()
    await new Promise((done) => setTimeout(done, 0))
  })
}

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  vi.stubGlobal("window", window)
  vi.stubGlobal("document", window.document)
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it("records a table's typed cell before a keystroke that came after it, while the cell is still sending", async () => {
  const parts = onSlide(xml(twoBoxSlide))
  const top = { x: 0, y: 0, width: 12192000, height: 3000000, rotation: 0, flipH: false, flipV: false }
  const edit = elementCommand(parts, openRegister("", ""), {
    change: "table",
    index: 0,
    size: { width: 12192000, height: 6858000, elements: [{ box: top }] },
  })
  if (edit === null) throw new Error("no table")
  let register = applied(openRegister("", ""), { command: "slide", file: [slideId("256")], edit })
  const base = slideBase(parts, register)
  const shape = readShapes(base).find((each) => each.shape === "4")
  if (shape === undefined) throw new Error("no table shape")
  const uploads: (() => void)[] = []
  device.link = {
    async openDeck() {
      return { ok: true, register }
    },
    async enqueue(_deck: string, value: string, at: typeof node, floor: string) {
      if (!register.nodes.includes(at)) register = applied(register, { command: "add", node: at, floor, route: "" })
      register = applied(register, { command: "person", node: at, value })
      return { ok: true, painted: value }
    },
    flush() {
      return new Promise((done) => uploads.push(() => done({ ok: true })))
    },
  }
  const recorded: string[] = []
  const tables: { current: ReturnType<typeof useTables> | null } = { current: null }
  const host = window.document.createElement("div")
  const root = createRoot(host)
  const tableDeck: TableDeck = {
    id: deck,
    current: 0,
    boxes: { current: new Map([[node, { id: node, file: "" }]]) },
    shapes: { current: new Map([[node, shape]]) },
    editParts: { current: base },
    canvases: { current: () => null },
    record: (entry) => recorded.push(`${entry.name} ${entry.session ?? ""}`.trim()),
    settle: () => undefined,
    showEdited: async () => undefined,
    changeElement: async () => undefined,
  }
  await settled(() =>
    root.render(createElement(Tables, { deck: tableDeck, exposed: (each) => (tables.current = each) })),
  )
  const onTable = tables.current?.canvas.onTable
  if (onTable === undefined) throw new Error("not rendered")
  await settled(() => onTable(node, { change: "cell", row: 0, column: 0, text: "N" }))
  await settled(() => onTable(node, { change: "cell", row: 0, column: 0, text: "No" }))
  recorded.push("keystroke")
  for (const upload of uploads.splice(0)) upload()
  await settled()
  for (const upload of uploads.splice(0)) upload()
  await settled()
  await settled(() => root.unmount())
  expect(recorded).toEqual(["text 1", "text 1", "keystroke"])
})

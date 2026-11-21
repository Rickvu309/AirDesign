import { boxPatch, elementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { emptyUndo, type UndoEntry } from "../undo-list"
import type { UndoButtonsState } from "./undo-buttons"
import type { DeckPaint } from "./use-deck-paint"
import { useUndoList, useUndoTurn, type UndoList } from "./use-undo"

type Seen = { renders: number; undo: UndoList | null; buttons: UndoButtonsState | null }

const node = elementId("256.2")
const box = { x: 0, y: 0, cx: 100, cy: 50 }
let window: Window & typeof globalThis
let root: Root | null = null

function typedEntry(session: number, before: string, after: string): UndoEntry {
  return {
    name: "text",
    session,
    undoable: {
      steps: [{ node, before: { text: { value: { set: before } } }, after: { text: { value: { set: after } } } }],
    },
  }
}

function Deck(props: { readonly seen: Seen }) {
  const undo = useUndoList()
  const nothing = () => undefined
  const shown = {} as DeckPaint
  const buttons = useUndoTurn({
    id: "deck",
    paintedDeck: "deck",
    undo,
    shown,
    notesBar: { show: nothing },
    settle: nothing,
  })
  props.seen.renders += 1
  props.seen.undo = undo
  props.seen.buttons = buttons
  return null
}

async function deck(): Promise<Seen> {
  const seen: Seen = { renders: 0, undo: null, buttons: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const shown = createRoot(host)
  root = shown
  await act(async () => shown.render(createElement(Deck, { seen })))
  return seen
}

async function recorded(seen: Seen, entry: UndoEntry): Promise<void> {
  await act(async () => {
    const slot = seen.undo?.records.current.hold()
    slot?.record(entry)
    slot?.release()
  })
}

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it("renders the deck once for a typing session, not once for each keystroke that lands", async () => {
  const seen = await deck()
  await recorded(seen, typedEntry(1, "", "T"))
  const typing = seen.renders
  let text = "T"
  for (const letter of "he quick brown fox") {
    await recorded(seen, typedEntry(1, text, text + letter))
    text += letter
  }
  expect(seen.renders - typing).toBe(0)
  expect(seen.buttons).toMatchObject({ undoLabel: "Undo text edit", canUndo: true, canRedo: false })
  expect(seen.undo?.undoList.current.undo).toEqual([typedEntry(1, "", text)])
})

it("renders the deck again when the step on top of the undo list changes", async () => {
  const seen = await deck()
  await recorded(seen, typedEntry(1, "", "T"))
  expect(seen.buttons).toMatchObject({ undoLabel: "Undo text edit", canUndo: true })
  await recorded(seen, {
    name: "move",
    undoable: { steps: [{ node, before: boxPatch(box), after: boxPatch({ ...box, x: 40 }) }] },
  })
  expect(seen.buttons).toMatchObject({ undoLabel: "Undo move", canUndo: true, canRedo: false })
})

it("clears the notice that an undo could not apply when the next step is recorded", async () => {
  const seen = await deck()
  await act(async () => seen.undo?.show(emptyUndo, "undo"))
  expect(seen.undo?.told).toBe("undo")
  await recorded(seen, typedEntry(1, "", "T"))
  expect(seen.undo?.told).toBeNull()
})

it("runs the next turn after one fails, and hands the failure to the caller of the failed turn", async () => {
  const seen = await deck()
  const undo = seen.undo
  if (undo === null) throw new Error("not rendered")
  const failed = undo.turnAfter(() => Promise.reject(new Error("device write failed")))
  let ran = false
  const next = undo.turnAfter(async () => {
    ran = true
  })
  await expect(failed).rejects.toThrow("device write failed")
  await next
  expect(ran).toBe(true)
})

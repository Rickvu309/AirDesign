import {
  decide,
  elementId,
  maskTurn,
  openRegister,
  placeOf,
  plainFrameTurn,
  slideId,
  type Box,
  type Command,
  type ElementId,
  type Register,
  type Row,
  type SlideCommand,
} from "@airdesign/document"
import { indexPackage } from "@airdesign/pptx"
import type { Selection } from "@airdesign/render"
import { act, createElement, useState } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { editableSlide } from "./editable-slide"
import type { UndoButtonsState } from "./undo-buttons"
import { useDeckPaint, type DeckPaint } from "./use-deck-paint"
import { useDeckStatus } from "./use-deck-status"
import { useUndoList, useUndoTurn, type UndoList } from "./use-undo"
import { onSlide, xml } from "../slide-fixtures"

const device = vi.hoisted(() => ({ link: null as unknown }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => device.link,
}))

type Exposed = { readonly shown: DeckPaint; readonly undo: UndoList; readonly buttons: UndoButtonsState }

const deck = "box-deck"
const slide = slideId("256")
const wide = elementId("256.3")
const small = elementId("256.4")
const frame = elementId("256.20")
const backdrop = elementId("256.21")
const shape = (id: number, x: number, cx: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${String(id)}" name="s${String(id)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${String(x)}" y="100000"/><a:ext cx="${String(cx)}" cy="40000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>`
const parts = onSlide(
  xml(
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 100000, 1000000)}${shape(4, 1060000, 40000)}</p:spTree></p:cSld></p:sld>`,
  ),
)
const hosts: { readonly unmount: () => Promise<void> }[] = []
let window: Window & typeof globalThis

function applied(register: Register, command: Command): Register {
  const named = command.command === "person" ? command.node : undefined
  const added =
    named !== undefined && register.elements[named] === undefined
      ? applied(register, { command: "add", node: named, floor: "", route: "deck" })
      : register
  const decision = decide(added, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function opened(): Register {
  const { slides, elements } = indexPackage(parts)
  return {
    ...openRegister("", ""),
    index: { total: elements.length, slides, elements, pages: [{ once: "page", offset: 0, count: elements.length }] },
  }
}

function framed(): Register {
  const register = opened()
  const turn = plainFrameTurn(register, [slide], slide, frame, backdrop, [wide, small])
  if (turn === null) throw new Error("plain frame")
  return turn.reduce(applied, register)
}

function boxOn(register: Register, node: ElementId): Box | null {
  return placeOf(register, node)?.box ?? null
}

function Deck(props: { readonly selected: Selection; readonly exposed: (deck: Exposed) => void }) {
  const nothing = () => undefined
  const [selection, select] = useState(props.selected)
  const notes = { show: nothing }
  const pictures = { store: { bytes: new Map(), load: async () => false, keep: nothing } }
  const undo = useUndoList()
  const { settle } = useDeckStatus(deck)
  const shown = useDeckPaint(deck, pictures, notes)
  const changeElement = async () => "kept" as const
  const buttons = useUndoTurn({ id: deck, paintedDeck: deck, undo, shown, notesBar: notes, settle: nothing })
  props.exposed({ shown, undo, buttons })
  return editableSlide({
    id: deck,
    shown,
    undo,
    settle,
    changeElement,
    selection,
    select,
  })(800)
}

async function boxDeck(start: Register, node: ElementId, inside: ElementId | null, beforeBox?: () => Promise<void>) {
  let register = start
  const sends: (() => void)[] = []
  device.link = {
    openDeck: async () => ({ ok: true, register }),
    async enqueueBox(_deck: string, box: Box, target: ElementId) {
      await beforeBox?.()
      register = applied(register, { command: "person", node: target, property: "box", value: box })
      return { ok: true, painted: box }
    },
    enqueueRow(_deck: string, row: Row, target: ElementId) {
      register = applied(register, { command: "person", node: target, v: row.v, patch: row.patch })
      return Promise.resolve({ ok: true, painted: row })
    },
    enqueueSlide(_deck: string, file: readonly ReturnType<typeof slideId>[], edit: SlideCommand) {
      register = applied(register, { command: "slide", file, edit })
      return Promise.resolve({ ok: true })
    },
    flush: () => new Promise((resolve) => sends.push(() => resolve({ ok: true }))),
    pending: async () => [],
  }
  const exposed: { current: Exposed | null } = { current: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const selected = { ids: [node], inside }
  await act(async () => root.render(createElement(Deck, { selected, exposed: (now) => (exposed.current = now) })))
  const now = exposed.current
  if (now === null) throw new Error("not rendered")
  await act(async () => {
    now.shown.shownParts.current = parts
    now.shown.showRegister(register)
  })
  hosts.push({
    unmount: async () => {
      await act(async () => {
        for (const send of sends.splice(0)) send()
        root.unmount()
      })
      host.remove()
    },
  })
  const element = host.querySelector<HTMLElement>(
    `[data-canvas-element="ppt/slides/slide1.xml#${node.split(".")[1] ?? ""}"]`,
  )
  if (element === null) throw new Error("not painted")
  await act(async () => element.focus())
  return {
    register: () => register,
    exposed: () => exposed.current ?? now,
    sends,
    nudge: (key: string, far = false) => {
      const keys = { bubbles: true, cancelable: true, key, shiftKey: far }
      element.dispatchEvent(new KeyboardEvent("keydown", keys))
      element.dispatchEvent(new KeyboardEvent("keyup", keys))
    },
  }
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
    ["Element", window.Element],
    ["Node", window.Node],
    ["KeyboardEvent", window.KeyboardEvent],
    ["Event", window.Event],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterEach(async () => {
  for (const host of hosts.splice(0)) await host.unmount()
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

function heldAnswer() {
  let answer: () => void = () => undefined
  const waiting = new Promise<void>((resolve) => {
    answer = resolve
  })
  return { waiting, answer }
}

it("undoes a nudge when Undo comes straight after it, before the device has stored the nudge", async () => {
  const start = opened()
  const moving = await boxDeck(start, wide, null)
  const before = boxOn(start, wide)
  await act(async () => {
    moving.nudge("ArrowRight")
    moving.exposed().buttons.onUndo()
    await moving.exposed().undo.turning.current
  })
  expect(boxOn(moving.register(), wide)).toEqual(before)
  expect(moving.exposed().undo.undoList.current.redo.map((entry) => entry.name)).toEqual(["move"])
})

it("lets the next turn run while the server has not answered a nudge that takes a layer out of its frame", async () => {
  const moving = await boxDeck(framed(), small, frame)
  let next = false
  await act(async () => {
    moving.nudge("ArrowRight", true)
    void moving.exposed().undo.turnAfter(async () => {
      next = true
    })
    for (let tick = 0; tick < 20 && !next; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(moving.exposed().undo.undoList.current.undo.map((entry) => entry.name)).toEqual(["move"])
  expect(moving.sends.length).toBeGreaterThan(0)
  expect(next).toBe(true)
})

it("keeps every nudge inside a mask while earlier nudges repaint", async () => {
  const register = opened()
  const masked = maskTurn(register, [slide], slide, frame, [small, wide], small)
  if (masked === null) throw new Error("mask group")
  const start = masked.commands.reduce(applied, register)
  const first = heldAnswer()
  const second = heldAnswer()
  const writingSecond = heldAnswer()
  let writes = 0
  const moving = await boxDeck(start, wide, frame, async () => {
    writes += 1
    if (writes === 1) await first.waiting
    if (writes === 2) {
      writingSecond.answer()
      await second.waiting
    }
  })
  const before = boxOn(start, wide)
  if (before === null) throw new Error("missing masked layer")
  await act(async () => {
    moving.nudge("ArrowRight", true)
    moving.nudge("ArrowRight", true)
    moving.nudge("ArrowRight", true)
    first.answer()
    await writingSecond.waiting
  })
  await act(async () => {
    moving.nudge("ArrowRight", true)
    second.answer()
    await moving.exposed().undo.turning.current
  })
  expect(boxOn(moving.register(), wide)).toEqual({ ...before, x: before.x + 4 * 127_000 })
  await act(async () => {
    moving.exposed().buttons.onUndo()
    await moving.exposed().undo.turning.current
  })
  expect(boxOn(moving.register(), wide)).toEqual({ ...before, x: before.x + 3 * 127_000 })
})

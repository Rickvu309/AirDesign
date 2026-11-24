import * as doom from "@airdesign/doom"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { agentRunsCopy } from "@/copy/agent-runs-copy"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let AgentRuns: typeof import("./agent-runs").AgentRuns

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>").window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
  AgentRuns = (await import("./agent-runs")).AgentRuns
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const grown = doom.doomFromTree({
  theme: doom.defaultTheme,
  slides: [{ children: [{ type: "shape", name: "Title" }] }],
})
const layer = grown.doom.children.get(grown.slides[0] as doom.NodeId)![0]!

function deckWithRun(): doom.Doom {
  const next = (fold: doom.Doom, edit: doom.Edit) => {
    const applied = doom.applyEdit(fold, { ...edit, rev: doom.rev(fold.rev + 1) })
    if (doom.isRefusal(applied)) throw new Error(applied.refused)
    return applied
  }
  const author: doom.Author = { kind: "agent", id: "claude", run: "c1", name: "Claude Code" }
  const started = next(grown.doom, {
    once: "c1",
    author,
    writes: [{ node: layer, prop: "name", value: "C" }],
    phase: "start",
  })
  return next(started, { once: "c1-stop", author, writes: [], phase: "stop" })
}

async function undoWith(reason: "nothing" | "refused" | "offline" | "size") {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const undoRun = async () =>
    ({ ok: false, reason, ...(reason === "refused" ? { refused: { refused: "stale" } } : {}) }) as never
  const render = (view: doom.Doom) =>
    act(async () => {
      root.render(createElement(AgentRuns, { view, editing: new Set<string>(), undoRun }))
    })
  const view = deckWithRun()
  await render(view)
  const button = host.querySelector<HTMLButtonElement>("[data-agent-run-undo]")
  await act(async () => {
    button?.click()
  })
  const result = {
    button: host.querySelector("[data-agent-run-undo]") !== null,
    note: host.querySelector("[data-agent-run-note]")?.textContent,
  }
  const later = doom.applyEdit(view, {
    once: "p1",
    author: { kind: "person", id: "p" } as doom.Author,
    writes: [{ node: layer, prop: "name", value: "Mine" }],
    rev: doom.rev(view.rev + 1),
  })
  if (doom.isRefusal(later)) throw new Error(later.refused)
  await render(later)
  const after = host.querySelector("[data-agent-run-note]")?.textContent
  await act(async () => root.unmount())
  host.remove()
  return { ...result, after }
}

it("keeps the Undo button when the run has nothing left, because undoing the newer write brings it back", async () => {
  expect(await undoWith("nothing")).toMatchObject({ button: true, note: agentRunsCopy.nothingLeft })
})

it("keeps the Undo button when the last Undo was refused", async () => {
  expect(await undoWith("refused")).toMatchObject({ button: true, note: agentRunsCopy.undoRefused })
})

it("drops a nothing-left or refused note once the deck changes, so it never outlives what it said", async () => {
  expect((await undoWith("nothing")).after).toBeUndefined()
  expect((await undoWith("refused")).after).toBeUndefined()
})

it("keeps the Undo button when the network failed, so the person can try again", async () => {
  expect(await undoWith("offline")).toMatchObject({ button: true, note: agentRunsCopy.undoFailed })
})

it("says when a run made too many changes to undo", async () => {
  expect(await undoWith("size")).toMatchObject({ button: true, note: agentRunsCopy.undoTooLarge })
})

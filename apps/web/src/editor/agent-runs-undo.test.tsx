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

async function undoWith(reason: "nothing" | "refused" | "offline") {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const undoRun = async () => ({ ok: false, reason }) as never
  await act(async () => {
    root.render(createElement(AgentRuns, { view: deckWithRun(), editing: new Set<string>(), undoRun }))
  })
  const button = host.querySelector<HTMLButtonElement>("[data-agent-run-undo]")
  await act(async () => {
    button?.click()
  })
  const result = {
    button: host.querySelector("[data-agent-run-undo]") !== null,
    note: host.querySelector("[data-agent-run-note]")?.textContent,
  }
  await act(async () => root.unmount())
  host.remove()
  return result
}

it("takes the Undo button away once the run has nothing left to undo, as Aira drops its link", async () => {
  expect(await undoWith("nothing")).toEqual({ button: false, note: agentRunsCopy.nothingLeft })
})

it("takes the Undo button away when everything the run changed was changed again, as Aira does", async () => {
  expect(await undoWith("refused")).toEqual({ button: false, note: agentRunsCopy.undoRefused })
})

it("keeps the Undo button when the network failed, so the person can try again", async () => {
  expect(await undoWith("offline")).toEqual({ button: true, note: agentRunsCopy.undoFailed })
})

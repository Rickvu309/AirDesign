import * as doom from "@airdesign/doom"
import { compileIntent, starts, testTheme } from "@airdesign/doom/testing"
import { gestures } from "@/lib/gestures"
import { describe, expect, it } from "vitest"
import { nodeModel } from "./editor/design-model"
import {
  agentFields,
  agentKinds,
  agentOps,
  built,
  idOf,
  layers,
  reach,
  sample,
  slide,
  writesOf,
} from "@/testing/agent-reach"
import { placement } from "@airdesign/doom/testing"

const owedToAgent: readonly string[] = []

const viewOnly = new Set([
  "select",
  "select-add",
  "deep-select",
  "marquee",
  "select-all",
  "step-in",
  "crop",
  "crop-end",
  "select-parent",
  "deselect",
  "copy",
  "zoom-in",
  "zoom-out",
  "zoom-fit",
  "zoom-actual",
  "zoom-selection",
  "tool-move",
  "tool-hand",
  "actions",
  "pan",
  "pan-arrows",
  "slide-previous",
  "slide-next",
  "slide-open",
  "slide-menu",
  "present",
  "present-here",
  "show-next",
  "show-previous",
  "show-first",
  "show-last",
  "show-number",
  "show-go",
  "show-erase",
  "show-stop",
  "show-presenter",
])

const manualPanel = new Set([
  "panel:theme",
  "panel:slide-background",
  "panel:remove-auto-layout",
  "panel:show-hidden",
  "panel:name",
])

function panelKeys(): ReadonlySet<string> {
  const keys = layers.flatMap((name) =>
    nodeModel({ view: built.view, id: idOf(name), theme: testTheme, slides: [slide] })
      .sections.flatMap((section) => section.strips.flat())
      .map((control) => `panel:${control.trait}.${control.field}`),
  )
  return new Set(keys)
}

function wordExists(word: string): boolean {
  const [where, name = ""] = word.split(".")
  if (where === "update") return agentFields.has(name)
  if (where === "op") return agentOps.has(name)
  if (where === "insert") return agentKinds.has(name)
  if (where === "variables") return name === "theme" && agentFields.has(name)
  return false
}

const editorSources: Readonly<Record<string, string>> = import.meta.glob(
  ["./editor/*.{ts,tsx}", "!./editor/*.test.{ts,tsx}"],
  { query: "?raw", import: "default", eager: true },
)

function sourceWrites(): ReadonlySet<string> {
  const found = new Set<string>()
  for (const text of Object.values(editorSources)) {
    for (const match of text.matchAll(/prop: "([a-zA-Z]+)"|setEach\(context, "([a-zA-Z]+)"/g))
      found.add(match[1] ?? match[2]!)
  }
  return found
}

const entries = Object.entries(reach)

describe("every capability a person has names its agent word, or says why it is the person's alone", () => {
  it("names every control the design panel shows", () => {
    expect([...panelKeys()].filter((key) => reach[key] === undefined)).toEqual([])
  })

  it("names every gesture that changes the deck, and only gestures that exist", () => {
    const ids = new Set<string>(gestures.map((row) => row.id))
    expect([...ids].filter((id) => !viewOnly.has(id) && reach[`gesture:${id}`] === undefined)).toEqual([])
    expect(entries.flatMap(([key]) => (key.startsWith("gesture:") && !ids.has(key.slice(8)) ? [key] : []))).toEqual([])
    expect([...viewOnly].filter((id) => !ids.has(id))).toEqual([])
  })

  it("names every property the editor writes in some capability", () => {
    const named = new Set(entries.flatMap(([, entry]) => entry.props))
    expect([...sourceWrites()].filter((prop) => !named.has(prop as doom.PropName))).toEqual([])
  })

  it("names a panel control, or a value case of one, only while the panel shows it", () => {
    const shown = panelKeys()
    expect(
      entries.flatMap(([key]) => {
        const control = key.split("#")[0]!
        return key.startsWith("panel:") && !manualPanel.has(control) && !shown.has(control) ? [key] : []
      }),
    ).toEqual([])
  })

  it("names only words the agent schema has", () => {
    expect(entries.flatMap(([key, entry]) => ("agent" in entry && !wordExists(entry.agent) ? [key] : []))).toEqual([])
  })

  it("lands each probed agent word on the property it names", () => {
    const missed = entries.flatMap(([key, entry]) => {
      if (!("agent" in entry) || entry.writes === undefined || entry.on === undefined) return []
      const field = entry.agent.split(".")[1]!
      return writesOf(entry.on, { [field]: sample[field] }).some((write) => write.prop === entry.writes) ? [] : [key]
    })
    expect(missed).toEqual([])
  })

  it("keeps a capability owed only while an agent cannot say it", () => {
    const said = entries.flatMap(([key, entry]) =>
      "owed" in entry && entry.probe !== undefined && !doom.isRefusal(doom.readIntent(entry.probe)) ? [key] : [],
    )
    expect(said).toEqual([])
  })

  it("lists the capabilities owed to agents, and no others", () => {
    expect(entries.flatMap(([key, entry]) => ("owed" in entry ? [key] : []))).toEqual(owedToAgent)
  })

  it.each([
    ["gesture:slide-group-up", [["a:4"], ["a:3"]]],
    ["gesture:slide-group-down", [["a:4"], ["a:3"]]],
    ["drag:slide-group-start", [["a:3", "a:4"]]],
    ["menu:new-slide-group", [["a:3"], ["new:1"], ["a:4"]]],
  ] as const)("%s lands the same slide groups through the agent", (capability, groups) => {
    const initial = doom.doomFromTree({ theme: testTheme, slides: [{ name: "Slides", children: [] }] }).doom
    const deck = [...initial.nodes.values()].find((node) => node.type === "deck")!
    const [first] = doom.slidesOf(initial)
    const previous = doom.parentOf(initial.nodes.get(doom.parentOf(first)!.id))!.at
    const left = doom.nodeId("a:1")
    const right = doom.nodeId("a:2")
    const one = doom.nodeId("a:3")
    const two = doom.nodeId("a:4")
    const key = doom.orderKeyBetween(previous, null)
    const land = (view: doom.Doom, author: doom.Author, writes: readonly doom.Write[]) => {
      const result = doom.applyEdit(view, { once: `parity-${view.rev}`, author, writes, rev: doom.rev(view.rev + 1) })
      if (doom.isRefusal(result)) throw new Error(JSON.stringify(result))
      return result
    }
    const view = land(initial, { kind: "person", id: "parity" }, [
      { node: left, prop: "type", value: "slideRow" },
      { node: left, prop: "parent", value: { id: deck.id, at: key } },
      { node: right, prop: "type", value: "slideRow" },
      { node: right, prop: "parent", value: { id: deck.id, at: doom.orderKeyBetween(key, null) } },
      { node: one, prop: "type", value: "slide" },
      { node: one, prop: "parent", value: { id: left, at: key } },
      { node: two, prop: "type", value: "slide" },
      { node: two, prop: "parent", value: { id: right, at: key } },
      { node: first!.id, prop: "parent", value: null },
    ])
    const entry = reach[capability]
    if (entry === undefined || !("agent" in entry)) throw new Error(`${capability} needs an intent`)
    const change = doom.readIntent(entry.probe)
    if (doom.isRefusal(change)) throw new Error(JSON.stringify(change))
    let minted = 0
    const writes = compileIntent(view, change, () => doom.nodeId(`new:${++minted}`), placement, starts)
    if ("refused" in writes) throw new Error(JSON.stringify(writes))
    const after = land(view, { kind: "person", id: "parity" }, writes)
    expect(doom.slideGroups(after).map((group) => group.slides)).toEqual(groups)
  })
})

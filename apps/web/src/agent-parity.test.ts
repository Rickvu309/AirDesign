import * as doom from "@airdesign/doom"
import { gestures } from "@airdesign/render"
import { describe, expect, it } from "vitest"
import { nodeModel } from "./doom-editor/design-model"
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

const slideOps = new Set(["add", "move", "delete"])

const owedToAgent = [
  "panel:shadow.opacity",
  "panel:link.target",
  "gesture:frame",
  "gesture:lock",
  "gesture:underline",
  "gesture:strike",
]

const viewOnly = new Set([
  "select",
  "select-add",
  "deep-select",
  "marquee",
  "select-all",
  "step-in",
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
  "slide-previous",
  "slide-next",
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
  "panel:slide-background",
  "panel:theme-colors",
  "panel:theme-fonts",
  "panel:chart-data",
  "panel:remove-auto-layout",
])

function panelKeys(): ReadonlySet<string> {
  const keys = layers.flatMap((name) =>
    nodeModel({ view: built.view, id: idOf(name), theme: doom.defaultTheme, slides: [slide] })
      .sections.flatMap((section) => section.strips.flat())
      .map((control) => `panel:${control.trait}.${control.field}`),
  )
  return new Set(keys)
}

function wordExists(word: string): boolean {
  const [where, name = ""] = word.split(".")
  if (where === "set") return agentFields.has(name)
  if (where === "op") return agentOps.has(name)
  if (where === "add") return agentKinds.has(name)
  if (where === "slide") return slideOps.has(name) && agentFields.has(name)
  return false
}

const editorSources: Readonly<Record<string, string>> = import.meta.glob(
  ["./doom-editor/*.{ts,tsx}", "!./doom-editor/*.test.{ts,tsx}"],
  { query: "?raw", import: "default", eager: true },
)

function sourceWrites(): ReadonlySet<string> {
  const found = new Set<string>()
  for (const text of Object.values(editorSources)) {
    for (const match of text.matchAll(/prop: "([a-zA-Z]+)"|setEach\(context, "([a-zA-Z]+)"/g))
      found.add(match[1] ?? match[2]!)
    for (const match of text.matchAll(/toggleWrites\([^)]*"([a-z]+)" : "([a-z]+)"/g)) {
      found.add(match[1]!)
      found.add(match[2]!)
    }
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
      "owed" in entry && entry.probe !== undefined && !doom.isRefusal(doom.readAgentChange(entry.probe)) ? [key] : [],
    )
    expect(said).toEqual([])
  })

  it("lists the capabilities owed to agents, and no others", () => {
    expect(entries.flatMap(([key, entry]) => ("owed" in entry ? [key] : []))).toEqual(owedToAgent)
  })
})

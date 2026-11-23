import * as doom from "@airdesign/doom"
import type { Desc } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { optionCopy } from "./copy/option-copy"
import type { PanelControl } from "./design/panel"
import { changeWrites } from "./doom-editor/design-changes"
import { nodeModel } from "./doom-editor/design-model"
import { grow, spot } from "@/testing/doom-fixtures"

type Problem = { readonly control: string; readonly missing: "label" | "copy" | "write" | "paint" | "undo" | "agent" }

const theme = doom.defaultTheme
const words: doom.Text = {
  chars: "Hello",
  spans: [],
  paras: [{}],
  style: "body",
  resize: "widthAndHeight",
  alignV: "top",
}
const solid = (name: doom.ColorVar) => [{ kind: "solid" as const, color: { var: name } }]
const outline: doom.StrokeStyle = { weight: 2, align: "inside", dash: "solid" }

const built = grow([
  { type: "shape", name: "words", props: { box: spot(100, 100, 300, 60), text: words } },
  {
    type: "shape",
    name: "card",
    props: {
      box: spot(100, 300, 200, 100),
      geometry: { kind: "rect" },
      fills: solid("accent1"),
      strokes: solid("text2"),
      stroke: outline,
      text: words,
    },
  },
  {
    type: "shape",
    name: "rule",
    props: {
      box: spot(600, 40, 100, 0),
      geometry: {
        kind: "line",
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        route: "straight",
        arrows: ["none", "none"],
      },
      strokes: solid("text2"),
      stroke: { weight: 4, align: "center", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "star",
    props: {
      box: spot(800, 200, 120, 120),
      geometry: { kind: "icon", name: "lucide/star" },
      strokes: solid("text2"),
      stroke: { weight: 10, align: "center", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "photo",
    props: {
      box: spot(500, 300, 200, 100),
      geometry: { kind: "rect" },
      fills: [{ kind: "image", asset: "a".repeat(64), fit: "fit" }],
    },
  },
  {
    type: "frame",
    name: "panel",
    props: { box: spot(300, 500, 400, 200), fills: solid("background2") },
    children: [],
  },
])
const { view, geometry } = built
const slide = built.slides[0]!
const size = doom.deckOf(view).size
const layers = ["words", "card", "rule", "star", "photo", "panel"] as const
const id = (name: string) => built.ids[name]!

const writesNothingOnDoom: readonly string[] = ["geometry.shape", "image.source"]
const paintsNothing: readonly string[] = ["link.target"]
const personOnlyOnDoom: readonly string[] = ["link"]

const kept: Readonly<Record<string, readonly unknown[]>> = {
  "text.style": ["heading", "caption"],
  "text.font": ["Georgia"],
  "fills.source": ["b".repeat(64)],
  "link.target": [{ kind: "url", url: "https://example.com" }],
  "geometry.shape": [{ preset: "ellipse", adjust: {} }],
}

function candidates(control: PanelControl): readonly unknown[] {
  const named = kept[`${control.trait}.${control.field}`]
  if (named !== undefined) return named
  const { desc, value } = control
  switch (desc.kind) {
    case "choice":
      return desc.options.filter((option) => option !== value)
    case "flag":
      return [value !== true]
    case "number":
      return typeof value === "number" && value > 0 ? [Math.round(value / 2)] : [50_800, 200]
    case "color":
      return [{ scheme: "accent2" }]
    case "union":
      return [{ solid: { scheme: "accent2" } }]
    default:
      return []
  }
}

function optionWords(desc: Desc): readonly string[] {
  switch (desc.kind) {
    case "choice":
      return desc.options
    case "union":
      return Object.entries(desc.cases).flatMap(([name, item]) => [name, ...optionWords(item)])
    case "record":
      return Object.entries(desc.fields).flatMap(([name, item]) => [name, ...optionWords(item)])
    case "list":
    case "named":
      return optionWords(desc.item)
    default:
      return []
  }
}

const painted = (from: doom.Doom) => JSON.stringify(doom.resolveSlide(from, slide, doom.measureWith({})))

function landedBy(writes: readonly doom.Write[], author: doom.Author = { kind: "person", id: "quan" }) {
  const landed: doom.Landed = {
    once: "probe",
    author,
    writes: writes.map((write) => {
      const was = view.revs.get(write.node)?.get(write.prop)
      return was === undefined ? write : { ...write, base: was }
    }),
    rev: doom.rev(view.rev + 1),
  }
  const after = doom.applyEdit(view, landed)
  return doom.isRefusal(after) ? null : { landed, after }
}

function controlsOf(name: string): readonly PanelControl[] {
  return nodeModel({ view, id: id(name), theme, slides: [slide] }).sections.flatMap((section) => section.strips.flat())
}

function agentProps(name: string): ReadonlySet<string> {
  const looks: readonly Record<string, unknown>[] = [
    { fill: "accent2" },
    { stroke: "accent2", strokeWidth: 3 },
    { color: "accent2" },
    { radius: 6 },
    { effect: "soft" },
    { opacity: 0.5 },
    { text: "Changed", textStyle: "heading", align: "center" },
    { name: "Renamed", hidden: true },
    { box: { x: 10, y: 10, w: 50, h: 50 } },
  ]
  let next = 0
  const mint = () => doom.nodeId(`m:${String((next += 1))}`)
  const found = new Set<string>()
  for (const look of looks) {
    const writes = doom.compileAgentChange(view, { op: "set", target: id(name), ...look } as doom.AgentChange, mint)
    if (!doom.isRefusal(writes)) for (const write of writes) if (write.node === id(name)) found.add(write.prop)
  }
  return found
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "rev")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, each]) => [key, sorted(each)]),
  )
}

const sameNodes = (left: doom.Doom, right: doom.Doom) =>
  [...left.nodes].every(([key, node]) => JSON.stringify(sorted(node)) === JSON.stringify(sorted(right.nodes.get(key))))

function controlProblems(name: string, control: PanelControl, agent: ReadonlySet<string>): Problem[] {
  const key = `${control.trait}.${control.field}`
  const named = `${name} ${key}`
  const problems: Problem[] = []
  if (control.label.trim() === "" && control.trait !== "box") problems.push({ control: named, missing: "label" })
  const shown =
    control.choices === undefined
      ? optionWords(control.desc).map((word) => optionCopy[`${control.field}.${word}`] ?? optionCopy[word] ?? "")
      : control.choices.map((choice) => choice.label)
  if (shown.some((words) => words.trim() === "")) problems.push({ control: named, missing: "copy" })
  const selection = control.field === "distribute" ? ["words", "card", "panel"].map(id) : [id(name)]
  const context = { view, ids: selection, geometry, size, slides: [slide] }
  const landings = candidates(control).flatMap((value) => {
    const writes = changeWrites(context, control, value)
    const landing = writes.length === 0 ? null : landedBy(writes)
    return landing === null ? [] : [{ writes, ...landing }]
  })
  const landing = landings.find((each) => painted(each.after) !== painted(view)) ?? landings[0]
  if (landing === undefined) {
    if (!writesNothingOnDoom.includes(key)) problems.push({ control: named, missing: "write" })
    return problems
  }
  const { writes } = landing
  if (!paintsNothing.includes(key) && painted(landing.after) === painted(view))
    problems.push({ control: named, missing: "paint" })
  const back = doom.invert(view, landing.after, landing.landed)
  const undone = doom.applyEdit(landing.after, {
    once: "undo",
    author: { kind: "person", id: "quan" },
    writes: back,
    rev: doom.rev(landing.after.rev + 1),
  })
  if (doom.isRefusal(undone) || !sameNodes(view, undone)) problems.push({ control: named, missing: "undo" })
  const personOnly = writes.some(
    (write) => write.node === id(name) && !agent.has(write.prop) && !personOnlyOnDoom.includes(write.prop),
  )
  if (personOnly && control.field !== "align" && control.field !== "distribute")
    problems.push({ control: named, missing: "agent" })
  return problems
}

function parityProblems(): readonly Problem[] {
  return layers.flatMap((name) => {
    const agent = agentProps(name)
    return controlsOf(name).flatMap((control) => controlProblems(name, control, agent))
  })
}

const found = parityProblems()

describe("every control of Doom's design panel reaches every layer", () => {
  it("has its words, writes the layer, paints the change, undoes to the same layer, and is open to an agent", () => {
    expect(found).toEqual([])
  })

  it("walks every option and case word of a field's kind for its copy", () => {
    const desc: Desc = {
      kind: "union",
      cases: { none: { kind: "mark" }, preset: { kind: "choice", options: ["dash", "dot"] } },
      plain: "preset",
    }
    expect(optionWords(desc)).toEqual(["none", "preset", "dash", "dot"])
  })

  it("names a control as writing nothing on Doom only while it writes nothing", () => {
    const writing = layers.flatMap((name) =>
      controlsOf(name).filter((control) => {
        const key = `${control.trait}.${control.field}`
        const context = { view, ids: [id(name)], geometry, size, slides: [slide] }
        return (
          writesNothingOnDoom.includes(key) &&
          candidates(control).some((value) => changeWrites(context, control, value).length > 0)
        )
      }),
    )
    expect(writing).toEqual([])
  })

  it("names a property as the person's alone only while no agent change writes it", () => {
    const open = layers.flatMap((name) => [...agentProps(name)].filter((prop) => personOnlyOnDoom.includes(prop)))
    expect(open).toEqual([])
  })
})

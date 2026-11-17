import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readDeckId } from "@airdesign/catalog"
import {
  decide,
  elementId,
  landedPatch,
  readTextValue,
  storedValue,
  themeNode,
  type Color,
  type ElementId,
  type ElementPatch,
  type Register,
  type Value,
} from "@airdesign/document"
import { call, openDeck, type Deck } from "@airdesign/engine"
import {
  colorHex,
  indexPackage,
  readParts,
  readShapes,
  readSlides,
  readTraits,
  shownAlphas,
  shownFill,
  shownTextStyle,
} from "@airdesign/pptx"
import { paintStore } from "@airdesign/render"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/field-fold/view.mjs"
import { paint } from "@/deck-paint"
import { themeOf } from "@/design-shown"
import { panelOf, type PanelControl, type ShownField } from "@/design/panel"
import { rebasedChange } from "@/design/rebase"
import { applyChange, deviceScope, valueFits, type ChangingDeck } from "@/design/trait-edit"
import { exportedParts } from "@/exported-parts"
import { busyElements, shownValue } from "@/live-repaint"
import { recorded, turnBack, type UndoEntry, type UndoList, type UndoLink } from "@/undo-list"
import { dumpTopics } from "./spec-dump.js"
import { agentSet, answered } from "./spec-agent.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Parts = ReadonlyMap<string, Uint8Array>
type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Pending = { readonly value: Value; readonly node: ElementId; readonly floor: string }
type World = {
  readonly server: Deck
  readonly read: Register
  readonly pending: readonly Pending[]
  readonly list: UndoList
  readonly told: number
}

const held = vi.hoisted(() => ({ world: null as unknown }))

vi.mock("@airdesign/live", async () => {
  const actual = await vi.importActual<object>("@airdesign/live")
  return { ...actual, connect: () => device }
})

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const parsed = readDeckId("field-fold-replay")
if (!parsed.ok) throw new Error("deck")
const deck = parsed.deck
const node = elementId("256.2")
const part = "ppt/slides/slide1.xml"
const person = { actor: "person" } as const
const personColour: Color = { rgb: "C00000" }
const personAlpha = 30_000
const personSize = 4000
const agentHex = "7030A0"
const agentAlpha = 45_000
const themeHex = "00B050"
const fileAlpha = 60_000
const opaque = 100_000

const styled = (slide: string) =>
  slide
    .replace(
      '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr>',
      `<a:solidFill><a:schemeClr val="accent1"><a:alpha val="${fileAlpha}"/></a:schemeClr></a:solidFill></p:spPr>` +
        '<p:style><a:lnRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef>' +
        '<a:fillRef idx="1"><a:schemeClr val="accent2"/></a:fillRef>' +
        '<a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef>' +
        '<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style>',
    )
    .replace(' sz="3200"', "")

let file: Parts = new Map()
let fileText = ""

function world(): World {
  if (held.world === null) throw new Error("no world")
  return held.world as World
}

function landedOn(register: Register, edit: Pending): Register {
  let current = register
  if (!current.nodes.includes(edit.node)) {
    const opened = decide(current, { command: "add", node: edit.node, floor: edit.floor, route: current.route })
    if (opened.decision === "refuse") throw new Error(opened.code)
    current = opened.register
  }
  const decision = decide(current, { command: "person", ...storedValue(edit.value), node: edit.node })
  if (decision.decision === "refuse") throw new Error(decision.code)
  return decision.register
}

function deviceRegister(): Register {
  const { read, pending } = world()
  return pending.reduce(landedOn, read)
}

function queued(value: Value, at: ElementId, floor: string) {
  const now = world()
  held.world = { ...now, pending: [...now.pending, { value, node: at, floor }] }
  return Promise.resolve({ ok: true })
}

const device: UndoLink = {
  openDeck: () => Promise.resolve({ ok: true, register: deviceRegister() }),
  enqueue: (_deck, value, at, floor) => queued({ value }, at, floor),
  enqueueBox: (_deck, box, at, floor) => queued({ property: "box", value: box }, at, floor),
  enqueueRow: (_deck, row, at, floor) => queued(row, at, floor),
  enqueueSlide: () => Promise.reject(new Error("no slide commands here")),
}

function opened(): Deck {
  const index = indexPackage(file)
  const started = openDeck(deck)
  return { ...started, register: { ...started.register, index: { ...index, total: index.elements.length, pages: [] } } }
}

function synced(): void {
  const { server, pending } = world()
  const batch = pending.map((edit) => ({ ...storedValue(edit.value), node: edit.node, floor: edit.floor }))
  const next = batch.length === 0 ? server : answered(call("commit_edits", server, person, { deck, batch }), "sync")
  held.world = { ...world(), server: next, read: next.register, pending: [] }
}

const shapes = () => readShapes(file)

const changing: ChangingDeck = {
  id: deck,
  parts: () => file,
  floor: () => fileText,
  file: () => null,
  fits: (at, value) =>
    valueFits(
      file,
      shapes().find((shape) => `${shape.slide}.${shape.shape}` === at),
      value,
    ),
  hold: () => () => undefined,
  record: (entry: UndoEntry) => {
    held.world = { ...world(), list: recorded(world().list, entry) }
  },
  show: () => undefined,
}

function painted(register: Register) {
  const shown = paint(paintStore(), file, register, busyElements())
  const at = { slide: "256", part, shape: "2" }
  const display = shown.display
  const fields: Record<string, ShownField> = {}
  const fill = shownFill(display, at)
  if (fill !== null) fields["fill.value"] = fill
  for (const [trait, value] of Object.entries(shownAlphas(display, at))) fields[`${trait}.alpha`] = { value, own: true }
  for (const [field, value] of Object.entries(shownTextStyle(display, at) ?? {})) fields[`text.${field}`] = value
  const scope = deviceScope(file, register).view(node)
  if (scope === undefined) throw new Error("no element on the device")
  const element = { ...scope, value: shownValue(register, node, fileText) }
  const reads = readTraits(shown.base).elements.get(node)?.reads ?? {}
  const model = panelOf(element, { reads, moves: false, fields })
  const controls = model.sections.flatMap((section) => section.strips.flat())
  const canvas = shown.canvases(0)?.elements.find((each) => each.id === node)
  return { display, fields, controls, canvas, theme: themeOf(display, part) }
}

function controlOf(controls: readonly PanelControl[], trait: string, field: string): PanelControl {
  const control = controls.find((each) => each.trait === trait && each.field === field)
  if (control === undefined) throw new Error(`no ${trait}.${field} control`)
  return control
}

async function changed(trait: string, field: string, value: unknown): Promise<void> {
  const { controls } = painted(deviceRegister())
  const control = controlOf(controls, trait, field)
  if (!(await applyChange(changing, rebasedChange(controls, control, value))))
    throw new Error(`${trait}.${field} refused`)
}

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

function colourCode(edit: unknown): number {
  if (edit === undefined || edit === "opening") return 1
  if (edit === "inherit") return 2
  if (same(edit, { set: { solid: personColour } })) return 3
  if (same(edit, { set: { solid: { ...personColour, transforms: [{ op: "alpha", val: opaque }] } } })) return 3
  if (same(edit, { set: { solid: { rgb: agentHex } } })) return 4
  throw new Error(`not a colour ${JSON.stringify(edit)}`)
}

function alphaCode(edit: unknown): number {
  if (edit === undefined || edit === "opening") return 5
  if (same(edit, { set: personAlpha })) return 6
  if (same(edit, { set: agentAlpha })) return 7
  throw new Error(`not an opacity ${JSON.stringify(edit)}`)
}

function sizeCode(edit: unknown): number {
  if (edit === undefined || edit === "opening" || same(edit, { set: fileText })) return 8
  const text = typeof edit === "object" && edit !== null && "set" in edit ? readTextValue(String(edit.set)) : null
  const sizes = (text ?? []).flatMap((paragraph) => paragraph.runs.map((run) => run.size))
  if (sizes.length > 0 && sizes.every((size) => size === personSize)) return 9
  throw new Error(`not a size ${JSON.stringify(edit)}`)
}

function codes(patch: ElementPatch): readonly number[] {
  return [colourCode(patch.fill?.value), alphaCode(patch.fill?.alpha), sizeCode(patch.text?.value)]
}

function folded(register: Register): readonly number[] {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  return codes(body === undefined ? {} : landedPatch(body, "text"))
}

function stepCode(entry: UndoEntry): number {
  const steps = "steps" in entry.undoable ? entry.undoable.steps : []
  const [step, ...rest] = steps
  if (step === undefined || rest.length > 0 || step.node !== node) throw new Error("not one step on the element")
  const named = (patch: ElementPatch) => {
    if (patch.fill?.value !== undefined) return colourCode(patch.fill.value)
    if (patch.fill?.alpha !== undefined) return alphaCode(patch.fill.alpha)
    return sizeCode(patch.text?.value)
  }
  return named(step.before) * 10 + named(step.after)
}

function hexOf(css: string | null | undefined): { readonly hex: string; readonly alpha: number } | null {
  const matched = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(css ?? "")
  if (matched === null) return null
  return { hex: (matched[1] ?? "").toUpperCase(), alpha: matched[2] === undefined ? 255 : parseInt(matched[2], 16) }
}

function swatch(theme: readonly { readonly scheme: string; readonly css: string }[], scheme: string): string {
  const found = theme.find((each) => each.scheme === scheme)
  if (found === undefined) throw new Error(`no ${scheme}`)
  return found.css.replace("#", "").toUpperCase()
}

function judged(target: Spec, said: string, failures: string[]) {
  const now = world()
  const device = deviceRegister()
  const expectSame = (what: string, code: unknown, model: unknown) => {
    if (!same(code, model))
      failures.push(`${said}\n  ${what}: code ${JSON.stringify(code)}, model ${JSON.stringify(model)}`)
  }
  expectSame("device fold", folded(device), [target.dColour, target.dAlpha, target.dSize])
  expectSame("server fold", folded(now.server.register), [target.sColour, target.sAlpha, target.sSize])
  expectSame(
    "undo list",
    now.list.undo.reduce((list, entry) => list * 100 + stepCode(entry), 0),
    target.undo,
  )
  expectSame("told", now.told, target.told)
  const shown = painted(device)
  const fill = controlOf(shown.controls, "fill", "value")
  const solid = (fill.value as { readonly solid?: Color } | undefined)?.solid
  const panelHex = solid === undefined ? null : colorHex(solid, shown.theme).toUpperCase()
  const fileTheme = themeOf(file, part)
  const wanted: Readonly<Record<string, string>> = {
    file: swatch(fileTheme, "accent1"),
    inherited: target.dTheme === 2 ? themeHex : swatch(fileTheme, "accent2"),
    person: personColour.rgb,
    agent: agentHex,
  }
  const alphas: Readonly<Record<string, number>> = {
    file: fileAlpha,
    inherited: opaque,
    person: personAlpha,
    agent: agentAlpha,
  }
  const colour = wanted[String(target.colour)]
  const alpha = alphas[String(target.alpha)]
  expectSame("panel colour", panelHex, colour)
  expectSame("panel colour in quiet ink", fill.inherited, target.quiet)
  expectSame("panel opacity of the fill", shown.fields["fill.alpha"]?.value, alpha)
  const canvas = hexOf(shown.canvas?.fill)
  expectSame("canvas colour", canvas?.hex, colour)
  expectSame("canvas opacity", canvas?.alpha, Math.round(((alpha ?? 0) / opaque) * 255))
  const size = controlOf(shown.controls, "text", "size")
  const inheritedSize = painted(openedRegister()).fields["text.size"]?.value
  expectSame("panel size", size.value, target.size === "person" ? personSize : inheritedSize)
  expectSame("panel size inherited", size.inherited, target.size !== "person")
  const exported = exportedParts(file, device).get(part)
  const original = file.get(part)
  const untouched = exported !== undefined && original !== undefined && same([...exported], [...original])
  expectSame("export writes the file's own bytes", untouched, target.bytes)
}

function openedRegister(): Register {
  return opened().register
}

const theme = { op: "set", target: "deck.theme", theme: { accent2: `#${themeHex}` } }

const actions: Record<string, () => Promise<void>> = {
  Reset: () => changed("fill", "value", null),
  SetColour: () => changed("fill", "value", { solid: personColour }),
  SetAlpha: () => changed("opacity", "opacity", personAlpha),
  SetSize: () => changed("text", "size", personSize),
  Undo: async () => {
    const turned = await turnBack(device, deck, world().list, "undo")
    if (turned.outcome === "empty") throw new Error("nothing to undo")
    const steps = "steps" in turned.entry.undoable ? turned.entry.undoable.steps : []
    const after = steps[0]?.after
    const field = after?.fill?.value !== undefined ? 1 : after?.fill?.alpha !== undefined ? 2 : 3
    held.world = { ...world(), list: turned.list, told: turned.outcome === "changed" ? field : 0 }
  },
  AgentColour: async () => {
    const change = { op: "set", target: node, fill: { value: `#${agentHex}` } }
    held.world = { ...world(), server: agentSet(world().server, node, change) }
  },
  AgentAlpha: async () => {
    const change = { op: "set", target: node, opacity: agentAlpha / 1000 }
    held.world = { ...world(), server: agentSet(world().server, node, change) }
  },
  AgentTheme: async () => {
    held.world = { ...world(), server: agentSet(world().server, themeNode, theme) }
  },
  Sync: async () => synced(),
}

function initialOf(graph: Graph): string {
  const found = [...graph.states].find(([, state]) => state.made === 0 && state.log === 0 && state.agent === "none")
  if (found === undefined) throw new Error("no initial state")
  return found[0]
}

async function replayed(graph: Graph, failures: string[]) {
  const start: World = { server: opened(), read: opened().register, pending: [], list: { undo: [], redo: [] }, told: 0 }
  const reached = new Map<string, World>([[initialOf(graph), start]])
  const queue = [...reached.keys()]
  let edges = 0
  while (queue.length > 0) {
    const from = queue.shift()
    const source = from === undefined ? undefined : graph.states.get(from)
    const kept = from === undefined ? undefined : reached.get(from)
    if (from === undefined || source === undefined || kept === undefined) throw new Error("state")
    for (const edge of graph.edges.filter((each) => each.from === from)) {
      const target = graph.states.get(edge.to)
      const action = actions[edge.action]
      if (target === undefined || action === undefined) throw new Error(`${edge.action} is not connected`)
      const said = `field-fold ${view.group(source)}: ${view.state(source)} -${edge.action}-> ${view.group(target)}: ${view.state(target)}`
      held.world = kept
      try {
        await action()
      } catch (error) {
        failures.push(`${said}\n  ${String(error)}`)
        continue
      }
      edges += 1
      judged(target, said, failures)
      if (!reached.has(edge.to)) {
        reached.set(edge.to, world())
        queue.push(edge.to)
      }
    }
    if (failures.length > 0) break
  }
  return { states: graph.states.size, reached: reached.size, edges }
}

beforeAll(async () => {
  const clean = await readParts(new Uint8Array(readFileSync(`${root}/scripts/pptx-fixtures/clean.pptx`)))
  const slide = new TextDecoder().decode(clean.get(part))
  const next = styled(slide)
  if (next === slide) throw new Error("the fixture did not change")
  const parts = new Map(clean)
  parts.set(part, new TextEncoder().encode(next))
  file = parts
  const element = indexPackage(file).elements.find((each) => each.node === node)
  if (element?.value === null || element?.value === undefined) throw new Error("no text on the element")
  fileText = element.value
  if (readSlides(file)[0]?.part !== part) throw new Error("slide part")
})

describe("field-fold replay", () => {
  it("drives every edge of a design panel field fold through the panel change, undo, the engine, the export and the paint", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "field-fold")
    if (spec === undefined) throw new Error("no field-fold spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const report = await replayed(graph, failures)
    expect(failures.slice(0, 5), JSON.stringify(report)).toEqual([])
    expect(report.edges).toBe(graph.edges.length)
    expect(report.reached).toBe(graph.states.size)
    expect(graph.states.size).toBeLessThan(500)
  }, 600_000)

  it("keeps the transparency Reset fill showed when the person then picks a colour", async () => {
    held.world = { server: opened(), read: opened().register, pending: [], list: { undo: [], redo: [] }, told: 0 }
    await actions.Reset?.()
    const reset = painted(deviceRegister()).fields["fill.alpha"]?.value
    expect(reset).toBe(opaque)
    await actions.SetColour?.()
    expect(painted(deviceRegister()).fields["fill.alpha"]?.value).toBe(reset)
  })

  it("undoes mixed color fields across nodes together", async () => {
    held.world = { server: opened(), read: opened().register, pending: [], list: { undo: [], redo: [] }, told: 0 }
    const typed = fileText.replace("Hello", "Already typed")
    expect(await applyChange(changing, { target: { node }, text: { value: typed } })).toBe(true)
    const recolored = typed.replace('"text":"Already typed"', '"text":"Already typed","color":{"rgb":"C00000"}')
    expect(
      await applyChange(changing, [
        { target: { node }, text: { value: recolored }, fill: { value: { solid: personColour } } },
        { target: { node: themeNode }, theme: { accent2: "FF0000" } },
      ]),
    ).toBe(true)
    expect(world().list.undo).toHaveLength(2)
    await actions.Undo?.()
    expect(shownValue(deviceRegister(), node, fileText)).toBe(typed)
    const turned = await turnBack(device, deck, world().list, "redo")
    expect(turned.outcome).toBe("turned")
    expect(shownValue(deviceRegister(), node, fileText)).toBe(recolored)
  })

  it.fails("keeps the reset fill opacity when an agent then sets the colour", async () => {
    held.world = { server: opened(), read: opened().register, pending: [], list: { undo: [], redo: [] }, told: 0 }
    await actions.Reset?.()
    await actions.Sync?.()
    const reset = painted(deviceRegister()).fields["fill.alpha"]?.value
    expect(reset).toBe(opaque)
    await actions.AgentColour?.()
    await actions.Sync?.()
    expect(painted(deviceRegister()).fields["fill.alpha"]?.value).toBe(reset)
  })
})

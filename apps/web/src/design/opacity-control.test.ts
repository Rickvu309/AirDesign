import { opacityWire } from "@airdesign/catalog"
import {
  alphaKeys,
  beforeOf,
  opacityFields,
  planChange,
  registerScope,
  undoOf,
  type Kind,
  type Register,
  type Row,
} from "@airdesign/document"
import { exportParts, fadedFrames, shownAlphas } from "@airdesign/pptx"
import { beforeAll, expect, it } from "vitest"
import { opacityCopy } from "@/copy/opacity-copy"
import {
  agentRegister,
  deckParts,
  element,
  indexed,
  judgedCases,
  landed,
  painted,
  placed,
  sameParts,
  type At,
  type Parts,
} from "@/testing/parity-probe"
import { panelOf } from "./panel"

const unjudgedOnDoom: readonly string[] = ["border.alpha", "fills.alpha", "layout.opacity", "text.alpha"]

type Layer = "change" | "wire" | "control" | "round-trip" | "paint-change" | "undo" | "pptx-case" | "copy"

type Problem = { readonly field: string; readonly missing: Layer }

type OpacityProbe = {
  readonly name: string
  readonly kind: Kind
  readonly deck: string
  readonly node: string
  readonly layers?: readonly string[]
}

const probes: readonly OpacityProbe[] = [
  { name: "shape", kind: "shape", deck: "doe-heat-pumps.pptx", node: "2797.13" },
  { name: "image", kind: "shape", deck: "doe-heat-pumps.pptx", node: "2883.13" },
  { name: "connector", kind: "connector", deck: "census-updating-spm.pptx", node: "324.26" },
  { name: "frame", kind: "group", deck: "frame.pptx", node: "256.2", layers: ["3", "4", "5"] },
]

const opacity = opacityWire.example.opacity * 1000

function factsOf(probe: OpacityProbe, text: boolean) {
  const frame = probe.layers === undefined ? {} : { frame: "auto" as const }
  return { kind: probe.kind, text, grouped: false, animated: false, ...frame }
}

function unfaded(parts: Parts, at: At, keys: readonly string[], layers?: readonly string[]): readonly string[] {
  if (layers !== undefined)
    return layers.some((shape) => shownAlphas(parts, { ...at, shape }).fills !== opacity) ? keys : []
  const shown: Readonly<Record<string, unknown>> = shownAlphas(parts, at)
  return keys.filter((key) => shown[key.split(".")[0] ?? ""] !== opacity)
}

function written(parts: Parts, register: Register): Parts {
  return fadedFrames(exportParts(parts, register), register)
}

function drawn(parts: Parts, at: At, layers?: readonly string[]): string {
  if (layers === undefined) return painted(parts, at)
  return JSON.stringify(layers.map((shape) => painted(parts, { ...at, shape })))
}

function panelRegister(register: Register, at: At): { readonly register: Register; readonly row: Row } | null {
  const scope = registerScope(register)
  const view = scope.view(at.node)
  const sections = view === undefined ? [] : panelOf(view, { reads: {}, moves: true }).sections
  const control = sections.find((section) => section.trait === "opacity")?.strips.flat()[0]
  const planned = control === undefined ? null : planChange(control.change(opacity), scope)
  const row = planned?.ok === true ? planned.rows[0]?.row : undefined
  if (row === undefined) return null
  const opened = landed(register, [
    { command: "add", node: at.node, floor: "", route: "clean" },
    { command: "person", node: at.node, ...row },
  ])
  return opened === null ? null : { register: opened, row }
}

async function kindProblems(probe: OpacityProbe): Promise<readonly Problem[]> {
  const { name, kind, deck, node, layers } = probe
  const parts = await deckParts(deck)
  const at = placed(parts, kind, node)
  const keys = opacityFields(factsOf(probe, element(parts, at)?.value != null))
  const missing = (fields: readonly string[], layer: Layer) =>
    fields.map((key): Problem => ({ field: `${name} ${key}`, missing: layer }))
  const shown = unfaded(parts, at, keys, layers)
  const problems = [
    ...missing(
      keys.filter((key) => !shown.includes(key)),
      "change",
    ),
  ]
  const agent = agentRegister(indexed(parts), at, opacityWire.example)
  problems.push(...missing(agent === null ? keys : unfaded(written(parts, agent), at, keys, layers), "wire"))
  const panel = panelRegister(indexed(parts), at)
  if (panel === null) problems.push(...missing(keys, "control"))
  const exported = panel === null ? parts : written(parts, panel.register)
  problems.push(...missing(unfaded(exported, at, keys, layers), "round-trip"))
  if (drawn(exported, at, layers) === drawn(parts, at, layers)) problems.push(...missing(keys, "paint-change"))
  const step = panel === null ? null : { node: at.node, before: beforeOf({}, panel.row.patch), after: panel.row.patch }
  const turn = panel === null || step === null ? null : undoOf(panel.register, { steps: [step] })
  const undone = panel === null || turn === null || !turn.ok ? null : landed(panel.register, turn.commands)
  if (undone === null || !sameParts(written(parts, undone), parts)) problems.push(...missing(keys, "undo"))
  const judged = keys.filter(
    (key) => !unjudgedOnDoom.includes(key) && !judgedCases.some((each) => each.covers?.includes(key)),
  )
  problems.push(...missing(judged, "pptx-case"))
  return problems
}

let found: readonly Problem[] = []
let probed: readonly string[] = []

beforeAll(async () => {
  const problems: Problem[] = []
  for (const probe of probes) problems.push(...(await kindProblems(probe)))
  found = problems
  probed = probes.flatMap((probe) => opacityFields(factsOf(probe, true)))
}, 120_000)

it("lands { opacity: 60 } on each kind that takes an alpha field as an agent and from the Opacity row, exports, reads, paints, undoes and judges every alpha it takes", () => {
  expect(found).toEqual([])
})

it("probes every alpha field some kind takes, and has words for the Opacity row and the agent", () => {
  expect(alphaKeys.filter((key) => !probed.includes(key))).toEqual([])
  for (const words of [opacityCopy.section, opacityCopy.label, opacityWire.description])
    expect(words.trim()).not.toBe("")
})

it("exempts an alpha from its PowerPoint case only while no case judges it", () => {
  expect(unjudgedOnDoom.filter((key) => judgedCases.some((each) => each.covers?.includes(key)))).toEqual([])
})

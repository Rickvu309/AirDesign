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
import { exportParts, shownAlphas, shownImage } from "@airdesign/pptx"
import { beforeAll, expect, it } from "vitest"
import { opacityCopy } from "@/copy/opacity-copy"
import { ensureMarkup } from "@/markup"
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
} from "@/parity-probe"
import { panelOf } from "./panel"

type Layer = "change" | "wire" | "control" | "round-trip" | "paint-change" | "undo" | "pptx-case" | "copy"

type Problem = { readonly field: string; readonly missing: Layer }

const probes: Partial<Readonly<Record<Kind, { readonly deck: string; readonly node: string }>>> = {
  shape: { deck: "doe-heat-pumps.pptx", node: "2797.13" },
  picture: { deck: "doe-heat-pumps.pptx", node: "2883.13" },
  connector: { deck: "census-updating-spm.pptx", node: "324.26" },
}

const opacity = opacityWire.example.opacity * 1000

function unfaded(parts: Parts, at: At, keys: readonly string[]): readonly string[] {
  const shown: Readonly<Record<string, unknown>> = { ...shownAlphas(parts, at), image: shownImage(parts, at)?.alpha }
  return keys.filter((key) => shown[key.split(".")[0] ?? ""] !== opacity)
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

async function kindProblems(kind: Kind, deck: string, node: string): Promise<readonly Problem[]> {
  const parts = await deckParts(deck)
  const at = placed(parts, kind, node)
  const keys = opacityFields({ kind, text: element(parts, at)?.value != null, grouped: false, animated: false })
  const missing = (fields: readonly string[], layer: Layer) =>
    fields.map((key): Problem => ({ field: `${kind} ${key}`, missing: layer }))
  const shown = unfaded(parts, at, keys)
  const problems = [
    ...missing(
      keys.filter((key) => !shown.includes(key)),
      "change",
    ),
  ]
  const agent = agentRegister(indexed(parts), at, opacityWire.example)
  problems.push(...missing(agent === null ? keys : unfaded(exportParts(parts, agent), at, keys), "wire"))
  const panel = panelRegister(indexed(parts), at)
  if (panel === null) problems.push(...missing(keys, "control"))
  const exported = panel === null ? parts : exportParts(parts, panel.register)
  problems.push(...missing(unfaded(exported, at, keys), "round-trip"))
  if (painted(exported, at) === painted(parts, at)) problems.push(...missing(keys, "paint-change"))
  const step = panel === null ? null : { node: at.node, before: beforeOf({}, panel.row.patch), after: panel.row.patch }
  const turn = panel === null || step === null ? null : undoOf(panel.register, { steps: [step] })
  const undone = panel === null || turn === null || !turn.ok ? null : landed(panel.register, turn.commands)
  if (undone === null || !sameParts(exportParts(parts, undone), parts)) problems.push(...missing(keys, "undo"))
  const judged = keys.filter((key) => !judgedCases.some((each) => each.covers?.includes(key)))
  problems.push(...missing(judged, "pptx-case"))
  return problems
}

let found: readonly Problem[] = []
let probed: readonly string[] = []

beforeAll(async () => {
  await ensureMarkup()
  const problems: Problem[] = []
  for (const [kind, probe] of Object.entries(probes) as [Kind, { deck: string; node: string }][])
    problems.push(...(await kindProblems(kind, probe.deck, probe.node)))
  found = problems
  probed = Object.keys(probes).flatMap((kind) =>
    opacityFields({ kind: kind as Kind, text: true, grouped: false, animated: false }),
  )
}, 120_000)

it("lands { opacity: 60 } on each kind that takes an alpha field as an agent and from the Opacity row, exports, reads, paints, undoes and judges every alpha it takes", () => {
  expect(found).toEqual([])
})

it("probes every alpha field some kind takes, and has words for the Opacity row and the agent", () => {
  expect(alphaKeys.filter((key) => !probed.includes(key))).toEqual([])
  for (const words of [opacityCopy.section, opacityCopy.label, opacityWire.description])
    expect(words.trim()).not.toBe("")
})

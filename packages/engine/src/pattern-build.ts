import {
  changeLayout,
  decide,
  elementId,
  format,
  nextElementId,
  shapeOf,
  slideMeasure,
  writeTextValue,
  type Box,
  type ElementId,
  type Register,
  type SetChange,
  type SlideId,
} from "@airdesign/document"
import { decided } from "./agent-elements.js"
import { applySet, landRow, openedRegister, type Applied } from "./apply-change.js"
import { paragraphsOf, type Line, type TypeScale } from "./pattern-type.js"

export type Build = {
  register: Register
  readonly file: readonly SlideId[]
  readonly slide: SlideId
  readonly runId: string
  readonly scale: TypeScale
}

export type Refusal = Extract<Applied, { readonly ok: false }>["refusal"]

export class Refused extends Error {
  readonly refusal: Refusal
  constructor(refusal: Refusal) {
    super(refusal)
    this.refusal = refusal
  }
}

export class Overflowed extends Error {}

function landed(result: Applied | { readonly ok: true; readonly register: Register }): Register {
  if (!result.ok) throw new Refused(result.refusal)
  return result.register
}

function started(build: Build, node: ElementId): void {
  const opened = landed(openedRegister(build.register, { node }))
  const body = opened.elements[node]
  if (body?.phase === "running" && body.runId === build.runId) {
    build.register = opened
    return
  }
  const begun = decide(opened, { command: "start", runId: build.runId, node })
  if (begun.decision === "refuse") throw new Refused(begun.code)
  build.register = begun.register
}

function nextNode(build: Build): ElementId {
  const measure = slideMeasure(build.register, build.slide)
  if (measure === undefined) throw new Refused("dead")
  return nextElementId(build.register, build.slide, measure.free)
}

type Opening = Readonly<Record<string, Readonly<Record<string, { readonly set: unknown }>>>>

export function layer(
  build: Build,
  kind: "shape" | "connector",
  box: Box,
  value: string | null,
  opening: Opening = {},
  geometry?: "line",
): ElementId {
  const node = nextNode(build)
  const element = { node, kind, value, box, grouped: false, ...(Object.keys(opening).length === 0 ? {} : { opening }) }
  const edit = {
    slide: "element-add",
    id: build.slide,
    element,
    runId: build.runId,
    ...(geometry === undefined ? {} : { geometry }),
  }
  build.register = landed(decided(build.register, build.file, edit as never, build.runId))
  started(build, node)
  return node
}

const flush = { left: 0, top: 0, right: 0, bottom: 0 }

export function textLayer(build: Build, box: Box, lines: readonly Line[], vertical?: "vert270"): ElementId {
  const node = layer(build, "shape", box, "")
  const value = writeTextValue(paragraphsOf(lines, build.scale))
  const turned = vertical === undefined ? {} : { vertical: { set: vertical } }
  const patch = {
    text: { value: { set: value } },
    body: {
      insets: { set: flush },
      autofit: { set: vertical === undefined ? "grow" : "none" },
      anchor: { set: vertical === undefined ? "t" : "ctr" },
      wrap: { set: true },
      ...turned,
    },
  }
  build.register = landed(landRow(build.register, node, { v: format, patch } as never, build.runId))
  return node
}

export function set(build: Build, node: ElementId, change: Omit<SetChange, "target">): void {
  build.register = landed(applySet(build.register, { target: { node }, ...change }, build.runId))
}

export function wrap(build: Build, nodes: readonly ElementId[]): ElementId {
  const node = nextNode(build)
  const backdrop = elementId(`${build.slide}.${String(Number(shapeOf(node).shape) + 1)}`)
  const changed = changeLayout(build.register, { wrap: nodes, slide: build.slide, node, backdrop })
  if (changed === null || !("slide" in changed)) throw new Refused("dead")
  build.register = landed(decided(build.register, build.file, { ...changed.slide, runId: build.runId }, build.runId))
  for (const row of changed.rows) {
    started(build, row.node)
    build.register = landed(landRow(build.register, row.node, { v: format, patch: row.patch }, build.runId))
  }
  started(build, node)
  started(build, backdrop)
  return node
}

export function padded(all: number): { left: number; top: number; right: number; bottom: number } {
  return { left: all, top: all, right: all, bottom: all }
}

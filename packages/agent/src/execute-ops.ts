import { readForAgent } from "./agent-read.js"
import * as doom from "@airdesign/doom"
import { placementRules, startRules, style, styles } from "@airdesign/taste"

import { doomRefused, refused, type Answer } from "./answer.js"
import { imagesPerCall } from "./budget.js"
import type { DeckHost, Opened } from "./deck-host.js"
import { readAnswer, themeValues } from "./deck-read.js"
import { withCatalogFonts } from "./font-names.js"
import { measuredSteps } from "./land-edit.js"
import { leavingMeasure } from "./leaving-measure.js"
import { layoutOf, listed } from "./problems-answer.js"
import { readPaste } from "./kit-paste.js"
import { imageName, imageProblem, pictureSizes, withAsset } from "./named-image.js"
import { onceIds } from "./once-ids.js"

export const verbs = [
  "insert",
  "copy",
  "update",
  "replace",
  "move",
  "remove",
  "group",
  "ungroup",
  "variables",
  "get",
  "screenshot",
] as const
export type Verb = (typeof verbs)[number]

export type Plan = {
  readonly opened: Opened
  readonly host: DeckHost
  readonly pendingFonts: ReadonlySet<string>
  readonly run: string
  readonly session: doom.IntentSession
  readonly pictures: Map<string, { readonly width: number; readonly height: number }>
  images: number
  view: doom.Doom
  ops: number
  read: boolean
  readonly intents: doom.Intent[]
  readonly intentOps: { readonly op: number; readonly verb: Verb }[]
  readonly names: Map<string, string>
  readonly shots: doom.NodeId[]
  refused?: { readonly op: number; readonly said: string; readonly answer: Readonly<Record<string, unknown>> }
}

export type OpAnswer = { readonly said: string; readonly fields: Readonly<Record<string, unknown>> }

export class OpRefused extends Error {
  readonly said: string
  readonly answer: Readonly<Record<string, unknown>>
  constructor({ said, fields }: OpAnswer) {
    super(String(fields.note))
    this.said = said
    this.answer = fields
  }
}

export function newPlan(
  opened: Opened,
  host: DeckHost,
  once: string,
  agent: { readonly id: string; readonly name?: string | undefined },
  runId: string | undefined,
  pendingFonts: ReadonlySet<string>,
): Plan {
  const ids = onceIds(once)
  const run = runId ?? ids.run
  const pictures = new Map<string, { readonly width: number; readonly height: number }>()
  const session = doom.intentSession(opened.fold, {
    author: {
      kind: "agent",
      id: agent.id,
      run,
      ...(runId === undefined && agent.name !== undefined ? { name: agent.name } : {}),
    },
    once,
    mint: ids.mint,
    placement: placementRules,
    starts: startRules,
    pictures,
    ...(runId === undefined ? { phase: "start" as const } : {}),
  })
  return {
    opened,
    host,
    pendingFonts,
    run,
    session,
    pictures,
    images: 0,
    view: opened.fold,
    ops: 0,
    read: false,
    intents: [],
    intentOps: [],
    names: new Map(),
    shots: [],
  }
}

const looks = doom.lookNames
const lookSet: ReadonlySet<string> = new Set(looks)

export const verbFields: Readonly<Record<Verb, readonly string[]>> = {
  insert: ["parent", "kind", "after", "group", ...looks],
  update: ["target", ...looks],
  replace: ["target", "kind", ...looks],
  copy: ["target", "targets", "from", "parent", "box"],
  move: ["target", "targets", "parent", "after", "before", "group", "box"],
  remove: ["target", "targets"],
  group: ["target", "targets", ...looks],
  ungroup: ["target"],
  variables: ["style", "colors", "fonts", "name", "nameFollows", "language"],
  get: ["target", "find", "cursor"],
  screenshot: ["target"],
}

const kindWords = (node: doom.Node) => (node.type === "slide" ? "slide" : doom.layerKind(node))
const isKind = (kind: unknown): kind is doom.NodeKind => doom.nodeKinds.includes(kind as doom.NodeKind)
const framed = new Set(doom.lookFieldsOf("update", "frame"))
const wordsInside: ReadonlySet<string> = new Set(
  doom.lookFieldsOf("update", "text").filter((field) => !framed.has(field)),
)

function kindFieldsOf(verb: Verb, kind: doom.NodeKind): readonly string[] {
  const place =
    verb === "insert"
      ? kind === "slide"
        ? ["kind", "after", "group"]
        : ["parent", "kind"]
      : verbFields[verb].filter((field) => !lookSet.has(field))
  return [...place, ...doom.lookFieldsOf(verb === "insert" || verb === "replace" ? "insert" : "update", kind)]
}

function unknownNote(plan: Plan, verb: Verb, fields: Readonly<Record<string, unknown>>, asked: unknown) {
  const field = fields.field
  if (fields.fault !== "unknown" || typeof field !== "string") return undefined
  const node = typeof fields.node === "string" ? plan.view.nodes.get(fields.node as doom.NodeId) : undefined
  const kind = isKind(fields.kind) ? fields.kind : isKind(asked) ? asked : undefined
  if (node !== undefined) {
    const named = kind ?? kindWords(node)
    const inside =
      named === "frame" && wordsInside.has(field)
        ? " Set it on the text layers inside: get({ target }).children lists them."
        : ""
    return `${node.id} is a ${named}, which takes no ${field}.${inside}`
  }
  if (kind !== undefined) return `A ${kind} takes no ${field}. Its fields: ${kindFieldsOf(verb, kind).join(", ")}.`
  return `${verb} takes no ${field}. Its fields: ${verbFields[verb].join(", ")}.`
}

export function opRefusal(
  plan: Plan,
  op: number,
  verb: Verb,
  answer: Readonly<Record<string, unknown>>,
  asked?: unknown,
): OpAnswer {
  const { note, form, ...rest } = answer
  const listed = unknownNote(plan, verb, answer, asked)
  const said = listed ?? String(note)
  return {
    said,
    fields: {
      ...rest,
      ...(listed !== undefined || form === undefined ? {} : { form }),
      op,
      verb,
      note: `Operation ${String(op)} (${verb}): ${said}`,
    },
  }
}

function stop(plan: Plan, op: number, verb: Verb, result: Answer, asked?: unknown): never {
  throw new OpRefused(opRefusal(plan, op, verb, result.fields, asked))
}

function stopDoom(
  plan: Plan,
  op: number,
  verb: Verb,
  refusal: doom.IntentRefusal | doom.Refusal,
  asked?: unknown,
): never {
  const { at: _at, change: _change, ...rest } = refusal as doom.IntentRefusal
  return stop(plan, op, verb, doomRefused(rest), asked)
}

async function withImages(plan: Plan, op: number, verb: Verb, intent: doom.Intent) {
  const name = plan.host.images === undefined ? undefined : imageName(intent)
  plan.images += name === undefined ? 0 : 1
  if (plan.images > imagesPerCall)
    stop(
      plan,
      op,
      verb,
      refused("limit", {
        field: "fill",
        note: `One call fetches at most ${String(imagesPerCall)} images. Add the rest in another call.`,
      }),
    )
  const found = name === undefined ? undefined : await plan.host.images?.(plan.opened.deck, [name])
  const problem = imageProblem(intent, found)
  if (problem !== undefined) stop(plan, op, verb, problem)
  if (found === undefined) return intent
  for (const [asset, size] of pictureSizes(found)) plan.pictures.set(asset, size)
  return withAsset(intent, found)
}

async function step(plan: Plan, op: number, verb: Verb, intent: doom.Intent, asked?: unknown) {
  if (plan.intents.length >= doom.limits.batch)
    stop(
      plan,
      op,
      verb,
      refused("limit", {
        note: `One call makes at most ${String(doom.limits.batch)} changes, and this one reached that before this operation. Send the rest in a second call.`,
      }),
    )
  const measure = await leavingMeasure(plan.host, [plan.view], [intent])
  const stepped = await measuredSteps(plan.session.step(intent, true, measure), plan.host, plan.pendingFonts)
  if ("fields" in stepped) stop(plan, op, verb, stepped)
  if ("refused" in stepped) stopDoom(plan, op, verb, stepped, asked)
  plan.intents.push(intent)
  plan.intentOps.push({ op, verb })
  plan.view = stepped.view
  return stepped.added
}

async function compile(plan: Plan, op: number, verb: Verb, raw: Readonly<Record<string, unknown>>) {
  const read = doom.readIntent({ ...raw, op: verb })
  if ("refused" in read) stopDoom(plan, op, verb, read, raw.kind)
  const fonts = withCatalogFonts(read)
  if ("fields" in fonts) stop(plan, op, verb, fonts)
  return step(plan, op, verb, await withImages(plan, op, verb, fonts), raw.kind)
}

function roots(plan: Plan, added: readonly doom.NodeId[]): readonly doom.NodeId[] {
  const fresh = new Set<string>(added)
  return added.filter((id) => !fresh.has(doom.parentOf(plan.view.nodes.get(id))?.id ?? ""))
}

const fieldsOf = (raw: unknown): Readonly<Record<string, unknown>> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : raw === undefined
      ? {}
      : { target: raw }

function known(plan: Plan, op: number, verb: Verb, fields: Readonly<Record<string, unknown>>) {
  const allowed = new Set(verbFields[verb])
  const unknown = Object.keys(fields).find((key) => !allowed.has(key))
  if (unknown !== undefined) stop(plan, op, verb, refused("field", { field: unknown, fault: "unknown" }))
}

function nodeOf(plan: Plan, op: number, verb: Verb, id: unknown, field: string): doom.Node {
  const node = typeof id === "string" ? plan.view.nodes.get(id as doom.NodeId) : undefined
  if (node === undefined || doom.parentOf(node) == null)
    stop(
      plan,
      op,
      verb,
      id === undefined
        ? refused("field", { field, fault: "missing" })
        : refused("dead", { field, node: typeof id === "string" ? id : JSON.stringify(id) }),
    )
  return node
}

function targeted(fields: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const { target, targets, ...rest } = fields
  const one = target === undefined ? [] : [target]
  const many = Array.isArray(targets) ? targets : targets === undefined ? [] : [targets]
  return { ...rest, targets: [...one, ...many] }
}

async function insert(plan: Plan, op: number, fields: Readonly<Record<string, unknown>>) {
  const added = await compile(plan, op, "insert", fields)
  if (fields.kind !== "slide") return roots(plan, added)
  return added.filter((id) => plan.view.nodes.get(id)?.type === "slide")
}

async function copy(plan: Plan, op: number, fields: Readonly<Record<string, unknown>>) {
  const paste = readPaste(fields)
  if (paste === undefined) return roots(plan, await compile(plan, op, "copy", targeted(fields)))
  if ("fields" in paste) stop(plan, op, "copy", paste)
  const parent = nodeOf(plan, op, "copy", fields.parent, "parent")
  return roots(plan, await step(plan, op, "copy", { op: "paste", parent: parent.id, ...paste }))
}

async function variables(plan: Plan, op: number, fields: Readonly<Record<string, unknown>>) {
  const { style: requested, ...look } = fields
  const chosen = style(requested)
  if (requested !== undefined && chosen === undefined) {
    const ids = styles.map(({ id }) => id).join(", ")
    stop(plan, op, "variables", refused("field", { field: "style", fault: "form", form: `One of ${ids}.` }))
  }
  if (Object.keys(fields).length > 0)
    await compile(plan, op, "variables", { ...look, ...(chosen === undefined ? {} : { theme: chosen.theme }) })
  return themeValues(doom.deckOf(plan.view).theme)
}

function viewed(plan: Plan): Opened {
  return { ok: true, deck: plan.opened.deck, rev: plan.opened.rev, fold: plan.view }
}

async function read(plan: Plan, op: number, verb: Verb, fields: Readonly<Record<string, unknown>>) {
  if (fields.target === undefined) {
    const query = {
      ...(typeof fields.find === "string" ? { find: fields.find } : {}),
      ...(typeof fields.cursor === "string" ? { cursor: fields.cursor } : {}),
    }
    const slides = doom.slidesOf(plan.view).map((slide) => slide.id)
    const laid = query.find === undefined ? await layoutOf(plan.host, plan.view, () => slides) : undefined
    const answered = readAnswer(viewed(plan), query, laid)
    if (!answered.ok) stop(plan, op, verb, answered)
    const { ok: _ok, problems, ...deck } = answered.fields
    return { kind: "deck", ...deck, problems: problems ?? [] }
  }
  const node = nodeOf(plan, op, verb, fields.target, "target")
  const slide = node.type === "slide" ? node.id : doom.slideOf(plan.view, node.id)
  if (slide === undefined) stop(plan, op, verb, refused("dead", { field: "target", node: node.id }))
  const laid = await layoutOf(plan.host, plan.view, () => [slide])
  const inside = new Set([node.id, ...doom.descendantsOf(plan.view, node.id).map((each) => each.id)])
  const lines = readForAgent(plan.view, [slide], laid.boxes, node.type === "slide" ? undefined : node.id).split("\n")
  const box = laid.boxes?.get(node.id) ?? doom.propOf(node, "box")
  return {
    id: node.id,
    kind: kindWords(node),
    ...(box === undefined ? {} : { box: { x: box.x, y: box.y, w: box.w, h: box.h } }),
    ...(node.type === "slide" ? {} : { parent: doom.parentOf(node)?.id }),
    children: doom.childrenOf(plan.view, node.id).map((child) => child.id),
    layers: (node.type === "slide"
      ? lines
      : lines.filter((line) => inside.has(line.trim().split(" ")[0] as doom.NodeId))
    ).join("\n"),
    problems: listed(
      laid.problems.filter((found) => found.node === undefined || inside.has(found.node as doom.NodeId)),
    ),
    ...(laid.layout === "measured" ? {} : { measured: false }),
  }
}

export async function runOperation(plan: Plan, verb: Verb, raw: unknown): Promise<unknown> {
  plan.ops += 1
  const op = plan.ops
  const fields = fieldsOf(raw)
  known(plan, op, verb, fields)
  const named = (ids: readonly string[]) => {
    if (ids.length === 1 && typeof fields.name === "string") plan.names.set(fields.name, ids[0] as string)
    return ids
  }
  switch (verb) {
    case "insert":
      return named(await insert(plan, op, fields))[0]
    case "copy":
      return named(await copy(plan, op, fields))
    case "replace":
    case "update":
    case "ungroup": {
      const made = roots(plan, await compile(plan, op, verb, fields))
      return verb === "replace" ? named(made)[0] : undefined
    }
    case "group":
      return named(roots(plan, await compile(plan, op, verb, targeted(fields))))[0]
    case "move":
    case "remove":
      await compile(plan, op, verb, targeted(fields))
      return undefined
    case "variables":
      return variables(plan, op, fields)
    case "get": {
      const value = await read(plan, op, verb, fields)
      plan.read = true
      return value
    }
    case "screenshot": {
      const slide = doom.slideOf(plan.view, nodeOf(plan, op, verb, fields.target, "target").id)
      if (slide !== undefined && !plan.shots.includes(slide)) plan.shots.push(slide)
      return undefined
    }
  }
}

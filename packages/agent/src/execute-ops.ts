import { intentsSchema } from "@airdesign/catalog"
import { readForAgent } from "./agent-read.js"
import * as doom from "@airdesign/doom"
import { placementRules, startRules, style, styles } from "@airdesign/taste"

import { doomRefused, refused, type Answer } from "./answer.js"
import { imagesPerCall } from "./budget.js"
import type { DeckHost, Opened } from "./deck-host.js"
import { deckMeasure } from "./deck-measure.js"
import { readAnswer, themeValues } from "./deck-read.js"
import { withCatalogFonts } from "./font-names.js"
import { measuredSteps } from "./land-edit.js"
import { layoutOf, listed } from "./problems-answer.js"
import { readPaste } from "./kit-paste.js"
import { imageNames, imageProblem, pictureSizes, withAssets } from "./named-image.js"
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
  refused?: { readonly op: number; readonly answer: Readonly<Record<string, unknown>> }
}

export class OpRefused extends Error {
  readonly answer: Readonly<Record<string, unknown>>
  constructor(answer: Readonly<Record<string, unknown>>) {
    super(String(answer.note))
    this.answer = answer
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

const notLook = new Set(
  "op kind slide into target node nodes after add move delete theme colors fonts nameFollows".split(" "),
)
const intentFields = intentsSchema.$defs.change.properties
const lookFields = Object.keys(intentFields).filter((key) => !notLook.has(key))
const textFields = new Set(
  "text insert textStyle color size font weight lineHeight letterSpacing case underline strike alignV spaceBefore spaceAfter language".split(
    " ",
  ),
)

export const verbFields: Readonly<Record<Verb, readonly string[]>> = {
  insert: ["parent", "kind", "after", "group", ...lookFields],
  update: ["target", ...lookFields],
  replace: ["target", "kind", ...lookFields],
  copy: ["target", "targets", "from", "parent", "box"],
  move: ["target", "targets", "parent", "after", "before", "group", "box"],
  remove: ["target", "targets"],
  group: ["target", "targets", ...lookFields],
  ungroup: ["target"],
  variables: ["style", "colors", "fonts", "name", "nameFollows", "language"],
  get: ["target", "find", "cursor"],
  screenshot: ["target"],
}

const kindWords = (node: doom.Node) => (node.type === "slide" ? "slide" : doom.layerKind(node))

export function opNote(plan: Plan, verb: Verb, answer: Readonly<Record<string, unknown>>): string {
  const said = String(answer.note).replace(/^Change \d+( \([^)]*\))?[.:] ?/, "")
  const field = typeof answer.field === "string" ? answer.field : undefined
  if (answer.fault !== "unknown" || field === undefined) return said
  const node = typeof answer.node === "string" ? plan.view.nodes.get(answer.node as doom.NodeId) : undefined
  if (node === undefined) return `${verb} takes no ${field}. Its fields: ${verbFields[verb].join(", ")}.`
  const kind = kindWords(node)
  const inside =
    textFields.has(field) && kind === "frame"
      ? " Set it on the text layers inside: get({ target }).children lists them."
      : ""
  return `${node.id} is a ${kind}, which takes no ${field}.${inside}`
}

function stop(plan: Plan, op: number, verb: Verb, result: Answer): never {
  const { change: _change, at: _at, note: _note, ...rest } = result.fields
  const note = `Operation ${String(op)} (${verb}): ${opNote(plan, verb, result.fields)}`
  throw new OpRefused({ ...rest, op, verb, note })
}

async function withImages(plan: Plan, op: number, verb: Verb, intent: doom.Intent) {
  const names = plan.host.images === undefined ? [] : imageNames([intent])
  plan.images += names.length
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
  const found = names.length === 0 ? undefined : await plan.host.images?.(plan.opened.deck, names)
  const problem = imageProblem([intent], found)
  if (problem !== undefined) stop(plan, op, verb, problem)
  if (found === undefined) return intent
  for (const [asset, size] of pictureSizes(found)) plan.pictures.set(asset, size)
  return withAssets([intent], found)[0] as doom.Intent
}

const leavesLayers = (intent: doom.Intent) =>
  intent.op === "delete" || intent.op === "unwrap" || (intent.op === "slide" && intent.delete !== undefined)

async function compileOne(
  plan: Plan,
  op: number,
  verb: Verb,
  raw: Readonly<Record<string, unknown>>,
): Promise<readonly string[]> {
  const read = doom.readIntent(raw)
  if ("refused" in read) stop(plan, op, verb, doomRefused({ ...read, change: verb }))
  const fonts = withCatalogFonts([read])
  if (!fonts.ok) stop(plan, op, verb, fonts.result)
  return stepOne(plan, op, verb, await withImages(plan, op, verb, fonts.intents[0] as doom.Intent))
}

async function stepOne(plan: Plan, op: number, verb: Verb, intent: doom.Intent): Promise<readonly string[]> {
  if (plan.intents.length >= doom.limits.batch)
    stop(
      plan,
      op,
      verb,
      refused("limit", {
        note: `One call makes at most ${String(doom.limits.batch)} changes, and this one reached that before this operation. Send the rest in a second call.`,
      }),
    )
  const measure = leavesLayers(intent) ? (await deckMeasure(plan.host, [plan.view]))?.measure : undefined
  const stepped = await measuredSteps(plan.session.step(intent, true, measure), plan.host, plan.pendingFonts)
  if ("fields" in stepped) stop(plan, op, verb, stepped)
  if ("refused" in stepped) stop(plan, op, verb, doomRefused({ ...stepped, change: verb }))
  plan.intents.push(intent)
  plan.intentOps.push({ op, verb })
  plan.view = stepped.view
  const fresh = new Set<string>(stepped.added)
  return stepped.added.filter((id) => !fresh.has(doom.parentOf(plan.view.nodes.get(id))?.id ?? ""))
}

const fieldsOf = (raw: unknown): Readonly<Record<string, unknown>> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : raw === undefined
      ? {}
      : { target: raw }

function without(fields: Readonly<Record<string, unknown>>, ...skip: readonly string[]) {
  const dropped = new Set(skip)
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !dropped.has(key)))
}

const hasLook = (fields: Readonly<Record<string, unknown>>) => Object.keys(fields).length > 0

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

function idsOf(fields: Readonly<Record<string, unknown>>): readonly string[] {
  const one = fields.target === undefined ? [] : [fields.target]
  const many = Array.isArray(fields.targets) ? fields.targets : fields.targets === undefined ? [] : [fields.targets]
  return [...one, ...many].map((each) => (typeof each === "string" ? each : JSON.stringify(each)))
}

function checked(plan: Plan, op: number, verb: Verb, raw: Readonly<Record<string, unknown>>) {
  const read = doom.readIntent({ ...raw, target: "a:1" })
  if ("refused" in read) stop(plan, op, verb, doomRefused({ ...read, change: verb }))
  const fonts = withCatalogFonts([read])
  if (!fonts.ok) stop(plan, op, verb, fonts.result)
}

async function insert(plan: Plan, op: number, verb: Verb, fields: Readonly<Record<string, unknown>>) {
  if (fields.kind === "slide") {
    const add = Object.fromEntries(
      (["after", "group"] as const).flatMap((key) => (fields[key] === undefined ? [] : [[key, fields[key]]])),
    )
    const look = without(fields, "kind", "after", "group", "parent")
    if (hasLook(look)) checked(plan, op, verb, { op: "set", ...look })
    const [slide] = await compileOne(plan, op, verb, { op: "slide", add })
    if (slide === undefined) stop(plan, op, verb, refused("field", { note: "The slide was not added." }))
    if (hasLook(look)) await compileOne(plan, op, verb, { op: "set", target: slide, ...look })
    return [slide]
  }
  const parent = nodeOf(plan, op, verb, fields.parent, "parent")
  const slide = doom.slideOf(plan.view, parent.id)
  if (slide === undefined) stop(plan, op, verb, refused("dead", { field: "parent", node: parent.id }))
  const place = parent.type === "slide" ? { slide } : { slide, into: parent.id }
  return compileOne(plan, op, verb, { op: "add", ...without(fields, "parent"), ...place })
}

async function copy(plan: Plan, op: number, verb: Verb, fields: Readonly<Record<string, unknown>>) {
  const paste = readPaste(fields)
  if (paste === undefined) return compileOne(plan, op, verb, { op: "duplicate", nodes: idsOf(fields) })
  if ("fields" in paste) stop(plan, op, verb, paste)
  const parent = nodeOf(plan, op, verb, fields.parent, "parent")
  return stepOne(plan, op, verb, { op: "paste", into: parent.id, ...paste })
}

async function replace(plan: Plan, op: number, verb: Verb, fields: Readonly<Record<string, unknown>>) {
  const old = nodeOf(plan, op, verb, fields.target, "target")
  const parent = doom.parentOf(old)
  if (parent == null || old.type === "slide")
    stop(plan, op, verb, refused("field", { field: "target", note: "replace takes a layer, not a slide." }))
  const held = doom.propOf(old, "box")
  const look = without(fields, "target")
  const [made] = await insert(plan, op, verb, {
    ...(look.box === undefined && held !== undefined ? { box: { x: held.x, y: held.y, w: held.w, h: held.h } } : {}),
    ...look,
    parent: parent.id,
  })
  if (made === undefined) stop(plan, op, verb, refused("field", { note: "The new layer was not added." }))
  await compileOne(plan, op, verb, { op: "move", node: made, into: parent.id, after: old.id })
  await compileOne(plan, op, verb, { op: "delete", nodes: [old.id] })
  return [made]
}

async function move(plan: Plan, op: number, verb: Verb, fields: Readonly<Record<string, unknown>>) {
  const ids = idsOf(fields)
  const first = nodeOf(plan, op, verb, ids[0], "target")
  if (first.type === "slide" || first.type === "slideRow") {
    const where = Object.fromEntries(
      (["after", "before", "group"] as const).flatMap((key) => (fields[key] === undefined ? [] : [[key, fields[key]]])),
    )
    const moved =
      first.type === "slideRow" ? { group: first.id } : ids.length === 1 ? { slide: ids[0] } : { slides: ids }
    await compileOne(plan, op, verb, { op: "slide", move: { ...moved, ...where } })
    return
  }
  const into =
    fields.parent ?? (fields.box === undefined && ids.length === 1 ? undefined : doom.slideOf(plan.view, first.id))
  await compileOne(plan, op, verb, {
    op: "move",
    ...(ids.length === 1 ? { node: ids[0] } : { nodes: ids }),
    ...(into === undefined ? {} : { into }),
    ...(fields.after === undefined ? {} : { after: fields.after }),
    ...(fields.box === undefined ? {} : { box: fields.box }),
  })
}

async function remove(plan: Plan, op: number, verb: Verb, fields: Readonly<Record<string, unknown>>) {
  const ids = idsOf(fields)
  if (ids.length === 0) stop(plan, op, verb, refused("field", { field: "target", fault: "missing" }))
  const slides = ids.filter((id) => nodeOf(plan, op, verb, id, "target").type === "slide")
  const layers = ids.filter((id) => !slides.includes(id))
  if (layers.length > 0) await compileOne(plan, op, verb, { op: "delete", nodes: layers })
  for (const slide of slides) await compileOne(plan, op, verb, { op: "slide", delete: slide })
}

async function group(plan: Plan, op: number, verb: Verb, fields: Readonly<Record<string, unknown>>) {
  const wrap = Object.fromEntries(
    (["layout", "clip"] as const).flatMap((key) => (fields[key] === undefined ? [] : [[key, fields[key]]])),
  )
  const look = without(fields, "target", "targets", "layout", "clip")
  if (hasLook(look)) checked(plan, op, verb, { op: "set", ...look })
  const [frame] = await compileOne(plan, op, verb, { op: "wrap", nodes: idsOf(fields), ...wrap })
  if (frame === undefined) stop(plan, op, verb, refused("field", { note: "The group was not made." }))
  if (hasLook(look)) await compileOne(plan, op, verb, { op: "set", target: frame, ...look })
  return [frame]
}

async function variables(plan: Plan, op: number, verb: Verb, fields: Readonly<Record<string, unknown>>) {
  const { style: requested, ...fieldsToRead } = fields
  const chosen = style(requested)
  if (requested !== undefined && chosen === undefined) {
    const ids = styles.map(({ id }) => id).join(", ")
    stop(plan, op, verb, refused("field", { field: "style", fault: "form", form: `One of ${ids}.` }))
  }
  if (hasLook(fields)) {
    await compileOne(plan, op, verb, {
      op: "deck",
      ...fieldsToRead,
      ...(chosen === undefined ? {} : { theme: chosen.theme }),
    })
  }
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
      return named(await insert(plan, op, verb, fields))[0]
    case "copy":
      return named(await copy(plan, op, verb, fields))
    case "replace":
      return named(await replace(plan, op, verb, fields))[0]
    case "group":
      return named(await group(plan, op, verb, fields))[0]
    case "update":
      await compileOne(plan, op, verb, { op: "set", ...fields })
      return undefined
    case "move":
      await move(plan, op, verb, fields)
      return undefined
    case "remove":
      await remove(plan, op, verb, fields)
      return undefined
    case "ungroup":
      await compileOne(plan, op, verb, { op: "unwrap", node: fields.target })
      return undefined
    case "variables":
      return variables(plan, op, verb, fields)
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

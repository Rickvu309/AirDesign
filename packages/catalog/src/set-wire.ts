import {
  inheritable,
  readElementId,
  readSlideId,
  roles,
  slideKinds,
  traitNames,
  traits,
  type AddChange,
  type Box,
  type Desc,
  type SetChange,
  type Target,
  type TraitName,
} from "@airdesign/document"
import { agentSchema, readAgent, type AgentRead, type JsonSchema } from "./agent-form.js"
import { traitWire } from "./trait-wire.js"

export type WireSet = SetChange & { readonly op: "set" }
export type WireAdd = AddChange & { readonly op: "add" }

type Refused = { readonly ok: false; readonly refusal: "field"; readonly field: string }
type Read<Change> = { readonly ok: true; readonly change: Change } | Refused
type Inputs = Readonly<Record<string, unknown>>

const slidePart = "(?:[0-9]{1,10}|n[0-9a-z]{12})"
const rolePart = `(?:${roles.join("|")})`
const ownKinds = slideKinds.join("|")
const targetPattern = `^(?:[0-9]{1,10}|${slidePart}\\.(?:[0-9]{1,10}|n[0-9a-z]{12}|${ownKinds}|${rolePart})|\\*\\.${rolePart})$`
const roleTarget = new RegExp(`^(${slidePart}|\\*)\\.(${rolePart})$`)

const addable = ["shape"] as const
const boxSides = { x: "x", y: "y", w: "cx", h: "cy" } as const

function refused(field: string): Refused {
  return { ok: false, refusal: "field", field }
}

function plainObject(raw: unknown): raw is Inputs {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
}

export function readTarget(raw: unknown): Target | null {
  const node = readElementId(raw)
  if (node !== undefined) return { node }
  const whole = readSlideId(raw)
  if (whole !== undefined) return { slide: whole }
  const found = typeof raw === "string" ? roleTarget.exec(raw) : null
  const role = roles.find((each) => each === found?.[2])
  if (found === null || role === undefined) return null
  if (found[1] === "*") return { role, slide: "every" }
  const slide = readSlideId(found[1])
  return slide === undefined ? null : { role, slide }
}

function wireFields(trait: TraitName): Readonly<Record<string, { readonly description: string }>> {
  return traitWire[trait].fields
}

function descOf(trait: TraitName, field: string): Desc | undefined {
  if (!Object.hasOwn(wireFields(trait), field)) return undefined
  const kinds: Readonly<Record<string, { readonly desc: Desc }>> = { ...traits[trait].fields, ...traits[trait].inputs }
  return kinds[field]?.desc
}

function wiredTrait(key: string): TraitName | undefined {
  return traitNames.find((trait) => trait === key && Object.keys(wireFields(trait)).length > 0)
}

function inherited(trait: TraitName, field: string): AgentRead {
  return inheritable(trait, field) ? { ok: true, value: null } : { ok: false }
}

function nullable(trait: TraitName, field: string, schema: JsonSchema): JsonSchema {
  if (!inheritable(trait, field)) return schema
  const types = Array.isArray(schema.type) ? (schema.type as readonly string[]) : [schema.type as string]
  return { ...schema, type: [...types, "null"] }
}

function readTrait(trait: TraitName, raw: unknown): Read<Inputs> {
  if (!plainObject(raw) || Object.keys(raw).length === 0) return refused(trait)
  const read: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(raw)) {
    const desc = descOf(trait, field)
    const got = desc === undefined ? null : value === null ? inherited(trait, field) : readAgent(desc, value)
    if (got === null || !got.ok) return refused(`${trait}.${field}`)
    read[field] = got.value
  }
  return { ok: true, change: read }
}

function readTraits(body: Inputs, head: readonly string[]): Read<Readonly<Record<string, Inputs>>> {
  const read: Record<string, Inputs> = {}
  for (const [key, raw] of Object.entries(body)) {
    if (head.includes(key)) continue
    const trait = wiredTrait(key)
    if (trait === undefined) return refused(key)
    const fields = readTrait(trait, raw)
    if (!fields.ok) return fields
    read[trait] = fields.change
  }
  return { ok: true, change: read }
}

export function readSetChange(raw: unknown): Read<WireSet> {
  if (!plainObject(raw) || raw.op !== "set") return refused("op")
  const target = readTarget(raw.target)
  if (target === null) return refused("target")
  const read = readTraits(raw, ["op", "target"])
  if (!read.ok) return read
  if (Object.keys(read.change).length === 0) return refused("set")
  return { ok: true, change: { op: "set", target, ...read.change } as WireSet }
}

function readBox(raw: unknown): Box | null {
  const read = readTrait("box", raw)
  if (!read.ok) return null
  const box = Object.fromEntries(Object.entries(boxSides).map(([field, side]) => [side, read.change[field]]))
  const { x, y, cx, cy } = box
  if (typeof x !== "number" || typeof y !== "number" || typeof cx !== "number" || typeof cy !== "number") return null
  return cx > 0 && cy > 0 ? { x, y, cx, cy } : null
}

export function readAddChange(raw: unknown): Read<WireAdd> {
  if (!plainObject(raw) || raw.op !== "add") return refused("op")
  const kind = addable.find((each) => each === raw.kind)
  if (kind === undefined) return refused("kind")
  const slide = readSlideId(raw.slide)
  if (slide === undefined) return refused("slide")
  const extra = Object.keys(raw).find((key) => !["op", "kind", "slide", "box", "text"].includes(key))
  if (extra !== undefined) return refused(extra)
  const box = raw.box === undefined ? undefined : readBox(raw.box)
  if (box === null) return refused("box")
  const text = raw.text === undefined ? undefined : readTrait("text", raw.text)
  if (text !== undefined && !text.ok) return text
  return {
    ok: true,
    change: {
      op: "add",
      kind,
      slide,
      ...(box === undefined ? {} : { box }),
      ...(text === undefined ? {} : { text: text.change }),
    } as WireAdd,
  }
}

function traitSchema(trait: TraitName, required: boolean): JsonSchema {
  const wire = traitWire[trait] as { readonly description?: string }
  const fields = Object.entries(wireFields(trait)).map(([field, { description }]) => {
    const desc = descOf(trait, field)
    if (desc === undefined) throw new Error(`${trait}.${field}`)
    return [field, { ...nullable(trait, field, agentSchema(desc)), description }] as const
  })
  return {
    type: "object",
    additionalProperties: false,
    ...(required ? { required: fields.map(([field]) => field) } : { minProperties: 1 }),
    ...(wire.description === undefined ? {} : { description: wire.description }),
    properties: Object.fromEntries(fields),
  }
}

export function setChangeSchema(): JsonSchema {
  const wired = traitNames.filter((trait) => wiredTrait(trait) !== undefined)
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "target"],
    minProperties: 3,
    description:
      "Set fields on every element the target names, in one step the person can undo. Each field is in the units its description gives.",
    properties: {
      op: { type: "string", const: "set" },
      target: {
        type: "string",
        pattern: targetPattern,
        description: `An element id such as 258.7 or 258.notes; a slide id such as 258 for the slide itself, whose fill is the slide's background; <slide>.<role> such as 258.title for the element with that role on one slide; or *.<role> such as *.title for it on every slide. Roles: ${roles.join(", ")}.`,
      },
      ...Object.fromEntries(wired.map((trait) => [trait, traitSchema(trait, false)])),
    },
  }
}

export function addChangeSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "kind", "slide"],
    description:
      "Add a text box to one slide. Leave box out to put it in the largest free area of the slide. Its id comes back in elements.",
    properties: {
      op: { type: "string", const: "add" },
      kind: { type: "string", enum: addable },
      slide: { type: "string", pattern: `^${slidePart}$`, description: "Slide id from airdesign_read_deck." },
      box: { ...traitSchema("box", true), description: "Where the box sits on the slide, in points. Send all four." },
      text: traitSchema("text", false),
    },
  }
}

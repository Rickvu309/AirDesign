import {
  inheritable,
  presetAdjusts,
  readElementId,
  readSlideId,
  readTableValue,
  roles,
  slideKinds,
  traitNames,
  traits,
  type AddChange,
  type Box,
  type Desc,
  type SlideId,
  type SetChange,
  type Target,
  type TraitName,
} from "@airdesign/document"
import { agentSchema, readAgent, type AgentRead, type JsonSchema } from "./agent-form.js"
import { canonicalFields, canonicalTraits } from "./field-alias.js"
import { opacityWire } from "./opacity-wire.js"
import { traitWire } from "./trait-wire.js"

export type WireSet = SetChange & { readonly op: "set" }
export type WireAdd = AddChange & { readonly op: "add" }

type Refused = { readonly ok: false; readonly refusal: "field"; readonly field: string }
type Read<Change> = { readonly ok: true; readonly change: Change } | Refused
type Inputs = Readonly<Record<string, unknown>>

const slidePart = "(?:[0-9]{1,10}|n[0-9a-z]{12})"
const rolePart = `(?:${roles.join("|")})`
const ownKinds = slideKinds.join("|")
const targetPattern = `^(?:[0-9]{1,10}|${slidePart}\\.(?:[0-9]{1,10}|n[0-9a-z]{12}|${ownKinds}|${rolePart})|\\*\\.${rolePart}|deck\\.templateStyle(?:s|[1-9][0-9]{0,3}))$`
const roleTarget = new RegExp(`^(${slidePart}|\\*)\\.(${rolePart})$`)

const addable = ["shape", "line", "arrow", "elbow", "table"] as const
const oldAddable = ["picture"]
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

function wireFields(trait: TraitName): Readonly<Record<string, { readonly description?: string }>> {
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

function presetFits(trait: TraitName, field: string, value: unknown): boolean {
  if (trait !== "geometry" || field !== "shape" || !plainObject(value)) return true
  const named: readonly string[] = presetAdjusts[value.preset as keyof typeof presetAdjusts]
  return plainObject(value.adjust) && Object.keys(value.adjust).every((name) => named.includes(name))
}

function readTrait(trait: TraitName, raw: unknown): Read<Inputs> {
  if (!plainObject(raw) || Object.keys(raw).length === 0) return refused(trait)
  const named = canonicalFields(trait, raw)
  if (!named.ok) return refused(named.field)
  const read: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(named.fields)) {
    const desc = descOf(trait, field)
    const got = desc === undefined ? null : value === null ? inherited(trait, field) : readAgent(desc, value)
    if (got === null || !got.ok || !presetFits(trait, field, got.value)) return refused(`${trait}.${field}`)
    read[field] = got.value
  }
  return { ok: true, change: read }
}

function readTraits(raw: Inputs, head: readonly string[]): Read<Readonly<Record<string, Inputs>>> {
  const named = canonicalTraits(raw)
  if (!named.ok) return refused(named.field)
  const body = named.fields
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

function readOpacity(raw: Inputs): Read<Inputs> {
  if (!Object.hasOwn(raw, "opacity")) return { ok: true, change: {} }
  const read = readAgent(opacityWire.desc, raw.opacity)
  return read.ok ? { ok: true, change: { opacity: read.value } } : refused("opacity")
}

export function readSetChange(raw: unknown): Read<WireSet> {
  if (!plainObject(raw) || raw.op !== "set") return refused("op")
  const target = readTarget(raw.target)
  if (target === null) return refused("target")
  const opacity = readOpacity(raw)
  if (!opacity.ok) return opacity
  const read = readTraits(raw, ["op", "target", "opacity"])
  if (!read.ok) return read
  if (Object.keys(read.change).length === 0 && Object.keys(opacity.change).length === 0) return refused("set")
  return { ok: true, change: { op: "set", target, ...opacity.change, ...read.change } as WireSet }
}

function boxOf(raw: unknown): Box | null {
  const read = readTrait("box", raw)
  if (!read.ok || Object.keys(read.change).some((field) => !Object.hasOwn(boxSides, field))) return null
  const box = Object.fromEntries(Object.entries(boxSides).map(([field, side]) => [side, read.change[field]]))
  const { x, y, cx, cy } = box
  if (typeof x !== "number" || typeof y !== "number" || typeof cx !== "number" || typeof cy !== "number") return null
  return { x, y, cx, cy }
}

export function readPlacedBox(raw: unknown): Box | null {
  const box = boxOf(raw)
  return box !== null && box.cx > 0 && box.cy > 0 ? box : null
}

function readLineBox(raw: unknown): Box | null {
  const box = boxOf(raw)
  return box !== null && box.cx >= 0 && box.cy >= 0 && box.cx + box.cy > 0 ? box : null
}

const addKeys = ["op", "kind", "slide", "box", "text", "icon", "connection", "table"]

function attached(end: unknown): boolean {
  return plainObject(end) && plainObject(end.shape)
}

function readLineAdd(raw: Inputs, kind: "line" | "arrow" | "elbow", slide: SlideId): Read<WireAdd> {
  if (raw.text !== undefined) return refused("text")
  if (raw.icon !== undefined) return refused("icon")
  const box = raw.box === undefined ? undefined : readLineBox(raw.box)
  if (box === null) return refused("box")
  const connection = raw.connection === undefined ? undefined : readTrait("connection", raw.connection)
  if (connection !== undefined && !connection.ok) return connection
  const ends = connection?.change
  if (box === undefined && !(attached(ends?.start) && attached(ends?.end))) return refused("box")
  return {
    ok: true,
    change: {
      op: "add",
      kind,
      slide,
      ...(box === undefined ? {} : { box }),
      ...(ends === undefined ? {} : { connection: ends }),
    } as WireAdd,
  }
}

function addedTable(raw: Inputs, slide: SlideId): Read<WireAdd> {
  const extra = ["text", "icon", "connection"].find((key) => raw[key] !== undefined)
  if (extra !== undefined) return refused(extra)
  const table = readTrait("table", raw.table)
  if (!table.ok || typeof table.change.value !== "string" || readTableValue(table.change.value) === null)
    return refused("table")
  const box = raw.box === undefined ? undefined : readPlacedBox(raw.box)
  if (box === null) return refused("box")
  const value = table.change.value
  return {
    ok: true,
    change: { op: "add", kind: "table", slide, ...(box === undefined ? {} : { box }), table: { value } },
  }
}

export function readAddChange(raw: unknown): Read<WireAdd> {
  if (!plainObject(raw) || raw.op !== "add") return refused("op")
  const kind = addable.find((each) => each === raw.kind)
  const old = oldAddable.includes(String(raw.kind))
  if (kind === undefined && !old) return refused("kind")
  const slide = readSlideId(raw.slide)
  if (slide === undefined) return refused("slide")
  const extra = Object.keys(raw).find((key) => !addKeys.includes(key))
  if (extra !== undefined) return refused(extra)
  if (kind === "table") return addedTable(raw, slide)
  if (raw.table !== undefined) return refused("table")
  if (kind === "line" || kind === "arrow" || kind === "elbow") return readLineAdd(raw, kind, slide)
  if (raw.connection !== undefined) return refused("connection")
  if (old && raw.icon === undefined) return refused("icon")
  if (raw.icon !== undefined && raw.text !== undefined) return refused("text")
  const box = raw.box === undefined ? undefined : readPlacedBox(raw.box)
  if (box === null) return refused("box")
  const placed = box === undefined ? {} : { box }
  if (raw.icon !== undefined) {
    const icon = readAgent(traits.fills.fields.source.desc, raw.icon)
    if (!icon.ok || typeof icon.value !== "string") return refused("icon")
    return { ok: true, change: { op: "add", kind: "shape", slide, ...placed, icon: icon.value } }
  }
  const text = raw.text === undefined ? undefined : readTrait("text", raw.text)
  if (text !== undefined && !text.ok) return text
  return {
    ok: true,
    change: {
      op: "add",
      kind: "shape",
      slide,
      ...placed,
      ...(text === undefined ? {} : { text: text.change }),
    } as WireAdd,
  }
}

function traitSchema(trait: TraitName, required: readonly string[] | null): JsonSchema {
  const wire = traitWire[trait] as { readonly description?: string }
  const named = Object.entries(wireFields(trait)).filter(([field]) => required === null || required.includes(field))
  const fields = named.map(([field, { description }]) => {
    const desc = descOf(trait, field)
    if (desc === undefined) throw new Error(`${trait}.${field}`)
    return [
      field,
      { ...nullable(trait, field, agentSchema(desc)), ...(description === undefined ? {} : { description }) },
    ] as const
  })
  return {
    type: "object",
    additionalProperties: false,
    ...(required === null ? { minProperties: 1 } : { required: fields.map(([field]) => field) }),
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
    description: "Set fields on all targets in one undo step.",
    properties: {
      op: { type: "string", const: "set" },
      target: {
        type: "string",
        pattern: targetPattern,
        description: "Layer (258.7, 258.notes), slide ID, slide.role (258.title), *.role, or deck.templateStyles.",
      },
      opacity: { ...agentSchema(opacityWire.desc), description: opacityWire.description },
      ...Object.fromEntries(wired.map((trait) => [trait, traitSchema(trait, null)])),
    },
  }
}

export function placedBoxSchema(): JsonSchema {
  return {
    ...traitSchema("box", Object.keys(boxSides)),
    description: "Box in points.",
  }
}

export const slideSchema: JsonSchema = {
  type: "string",
  pattern: `^${slidePart}$`,
  description: "Slide id from airdesign_read_deck.",
}

export function addChangeSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["op", "kind", "slide"],
    description:
      "Add text, a Lucide icon, a line, an arrow, an elbow line or a table. Omit box to use the largest free area. A line runs from box top-left to bottom-right, w or h may be 0; omit box when both connection ends attach. Returns its id in elements.",
    properties: {
      op: { type: "string", const: "add" },
      kind: { type: "string", enum: addable },
      slide: slideSchema,
      box: placedBoxSchema(),
      text: traitSchema("text", null),
      icon: {
        ...agentSchema(traits.fills.fields.source.desc),
        description: "An icon name such as rocket, in place of text.",
      },
      connection: traitSchema("connection", null),
      table: traitSchema("table", null),
    },
  }
}

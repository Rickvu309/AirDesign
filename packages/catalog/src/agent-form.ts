import { linkSchema } from "./link-schema.js"
import { readLinkTarget } from "@airdesign/document"
import {
  designBytes,
  designOrder,
  shadowSlotKeys,
  iconNamePattern,
  readElementId,
  type Desc,
  type NumberUnit,
  type Design,
  type DesignKey,
  type ElementRead,
  type FillRead,
  type IndexElement,
  type Read,
  type BoundRead,
  type Shown,
  type TemplateFont,
  type TraitReads,
} from "@airdesign/document"
import { bytesOf } from "@airdesign/doom"
import { cornersAgents } from "./agent-corners.js"
import { effectAgents } from "./agent-effects.js"
import { identityAgents } from "./agent-identity.js"
import { imageAgents } from "./agent-image.js"
import { fontReferences } from "./template-font.js"
import { agentColor, colorPattern, hexPattern, readAgentColor, readAgentHex } from "./agent-color.js"
import { knownIcon } from "./icon-names.js"
import { imageAddressLength, pictureSourcePattern, webImage } from "./image-address.js"
import { storableText } from "./storable-text.js"

const emuPerPoint = 12_700
const anglePerDegree = 60_000
const hundredthsPerPoint = 100

function tenths(value: number): number {
  return Math.round(value * 10) / 10
}

function agentFill(fill: FillRead): string {
  if (fill === "image" || fill === "group") return fill
  if ("color" in fill) return agentColor(fill.color)
  if ("gradient" in fill) return `gradient ${fill.gradient.map(agentColor).join(", ")}`
  return `pattern ${fill.pattern}`
}

function agentBound(bound: BoundRead): string {
  return `${bound.node} site ${String(bound.site)}`
}

type Agent = { readonly [Key in DesignKey]: (read: NonNullable<TraitReads[Key]>["value"]) => Shown[0] }

const agent: Agent = {
  geometry: (value) => value,
  ...cornersAgents,
  fills: agentFill,
  "border.width": (value) => tenths(value / emuPerPoint),
  "border.fill": agentFill,
  "border.dash": (value) => value,
  "border.head": (value) => value,
  "border.tail": (value) => value,
  ...effectAgents,
  "text.size": (value) => tenths(value / hundredthsPerPoint),
  "text.color": agentColor,
  "text.font": (value) => value,
  "text.bold": (value) => value,
  "body.anchor": (value) => value,
  "body.autofit": (value) => value,
  "body.vertical": (value) => value,
  "box.rot": (value) => tenths(value / anglePerDegree),
  "box.flipH": (value) => value,
  "box.flipV": (value) => value,
  ...imageAgents,
  ...identityAgents,
  "connection.start": agentBound,
  "connection.end": agentBound,
}

function shownOf<Key extends DesignKey>(
  key: Key,
  read: Read<NonNullable<TraitReads[Key]>["value"]> & { readonly templateFont?: TemplateFont },
): Shown {
  const value = read.templateFont === undefined ? agent[key](read.value) : fontReferences[read.templateFont]
  return read.source === undefined ? [value] : [value, read.source]
}

export function designOf(read: ElementRead): Pick<IndexElement, "role" | "design" | "kept" | "placed" | "link"> {
  const design: Partial<Record<DesignKey, Shown>> = {}
  const stacked = shadowSlotKeys.some((slot) => read.reads[slot] !== undefined)
  const primary = ["effects.shadow", "effects.innerShadow"] as const
  const order = stacked
    ? [...primary, ...designOrder.filter((key) => !primary.some((slot) => slot === key))]
    : designOrder
  for (const key of order) {
    const field = read.reads[key] as Read<never> | undefined
    if (field === undefined) continue
    const shown = shownOf(key, field)
    const trial = { ...design, [key]: shown }
    if (bytesOf(JSON.stringify(trial)) > designBytes) break
    design[key] = shown
  }
  for (const slot of shadowSlotKeys) {
    const field = read.reads[slot]
    if (field !== undefined) design[slot] = shownOf(slot, field)
  }
  const written: Design = design
  return {
    ...(read.link === undefined ? {} : { link: read.link }),
    ...(read.role === undefined ? {} : { role: read.role }),
    ...(Object.keys(written).length === 0 ? {} : { design: written }),
    ...(read.kept.length === 0 ? {} : { kept: read.kept }),
    ...(read.placed === undefined ? {} : { placed: read.placed }),
  }
}

export type JsonSchema = Readonly<Record<string, unknown>>

export type AgentRead = { readonly ok: true; readonly value: unknown } | { readonly ok: false }

type NumberDesc = Extract<Desc, { readonly kind: "number" }>

const agentScale: { readonly [Unit in NumberUnit]: number } = {
  emu: emuPerPoint,
  angle: anglePerDegree,
  fraction: 1_000,
  "hundredth-point": hundredthsPerPoint,
  count: 1,
}

const powerPointWidestSlide = 51_206_400

const refused: AgentRead = { ok: false }

function plainObject(raw: unknown): raw is Readonly<Record<string, unknown>> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
}

export function agentNumberOf(unit: NumberUnit, stored: number): number {
  return tenths(stored / agentScale[unit])
}

function agentRange(desc: NumberDesc): { readonly type: string; readonly minimum: number; readonly maximum: number } {
  const factor = agentScale[desc.unit]
  const low = desc.unit === "emu" ? Math.max(desc.min, -powerPointWidestSlide) : desc.min
  const high = desc.unit === "emu" ? Math.min(desc.max, powerPointWidestSlide) : desc.max
  return { type: desc.unit === "count" ? "integer" : "number", minimum: low / factor, maximum: high / factor }
}

function escaped(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function unionSchema(desc: Extract<Desc, { readonly kind: "union" }>): JsonSchema {
  const strings: string[] = []
  const objects: Record<string, JsonSchema> = {}
  let number: ReturnType<typeof agentRange> | null = null
  for (const [name, item] of Object.entries(desc.cases)) {
    if (item.kind === "mark") {
      strings.push(escaped(name))
      continue
    }
    objects[name] = agentSchema(item)
    if (name !== desc.plain) continue
    if (item.kind === "choice") strings.push(...item.options.map(escaped))
    else if (item.kind === "color") strings.push(colorPattern)
    else if (item.kind === "number") number = agentRange(item)
  }
  const types: string[] = []
  const schema: Record<string, unknown> = {}
  if (strings.length > 0) {
    types.push("string")
    schema.pattern = `^(?:${strings.join("|")})$`
  }
  if (number !== null) {
    types.push(number.type)
    schema.minimum = number.minimum
    schema.maximum = number.maximum
  }
  if (Object.keys(objects).length > 0) {
    types.push("object")
    Object.assign(schema, { properties: objects, additionalProperties: false, minProperties: 1, maxProperties: 1 })
  }
  return { type: types.length === 1 ? types[0] : types, ...schema }
}

export function agentSchema(desc: Desc): JsonSchema {
  switch (desc.kind) {
    case "number":
      return agentRange(desc)
    case "flag":
      return { type: "boolean" }
    case "mark":
      return { type: "boolean", const: true }
    case "words":
      return { type: "string", maxLength: desc.max }
    case "asset":
      return desc.media === true
        ? { type: "string", pattern: pictureSourcePattern, maxLength: imageAddressLength }
        : { type: "string", pattern: iconNamePattern }
    case "link":
      return linkSchema
    case "text":
    case "node":
      return { type: "string" }
    case "choice":
      return desc.custom === undefined
        ? { type: "string", enum: desc.options }
        : {
            type: ["string", "object"],
            pattern: `^(?:${desc.options.map(escaped).join("|")})$`,
            properties: { custom: agentSchema(desc.custom) },
            required: ["custom"],
            additionalProperties: false,
          }
    case "color":
      return { type: "string", pattern: `^${colorPattern}$` }
    case "hex":
      return { type: "string", pattern: `^${hexPattern}$` }
    case "alpha":
      throw new Error("an alpha field is never on the wire")
    case "record":
      return {
        type: "object",
        additionalProperties: false,
        required: Object.keys(desc.fields),
        properties: Object.fromEntries(Object.entries(desc.fields).map(([name, field]) => [name, agentSchema(field)])),
      }
    case "list":
      return {
        type: "array",
        items: agentSchema(desc.item),
        ...(desc.min === 0 ? {} : { minItems: desc.min }),
        maxItems: desc.max,
      }
    case "named":
      return { type: "object", additionalProperties: agentSchema(desc.item), maxProperties: desc.max }
    case "union":
      return unionSchema(desc)
  }
}

function readNumber(desc: NumberDesc, raw: unknown): AgentRead {
  const range = agentRange(desc)
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < range.minimum || raw > range.maximum) return refused
  if (desc.unit === "count" && !Number.isInteger(raw)) return refused
  const value = Math.round(raw * agentScale[desc.unit])
  return { ok: true, value: Object.is(value, -0) ? 0 : value }
}

function readFields(fields: Readonly<Record<string, Desc>>, raw: unknown): AgentRead {
  if (!plainObject(raw) || Object.keys(raw).length !== Object.keys(fields).length) return refused
  const value: Record<string, unknown> = {}
  for (const [name, field] of Object.entries(fields)) {
    const read = Object.hasOwn(raw, name) ? readAgent(field, raw[name]) : refused
    if (!read.ok) return refused
    value[name] = read.value
  }
  return { ok: true, value }
}

function readItems(item: Desc, raw: unknown, min: number, max: number): AgentRead {
  if (!Array.isArray(raw) || raw.length < min || raw.length > max) return refused
  const items: unknown[] = []
  for (const each of raw) {
    const read = readAgent(item, each)
    if (!read.ok) return refused
    items.push(read.value)
  }
  return { ok: true, value: items }
}

function readNamed(item: Desc, raw: unknown, max: number): AgentRead {
  if (!plainObject(raw) || Object.keys(raw).length > max) return refused
  const value: Record<string, unknown> = {}
  for (const [name, each] of Object.entries(raw)) {
    const read = readAgent(item, each)
    if (!read.ok) return refused
    value[name] = read.value
  }
  return { ok: true, value }
}

function caseOf(desc: Extract<Desc, { readonly kind: "union" }>, name: string | undefined): Desc | undefined {
  return name !== undefined && Object.hasOwn(desc.cases, name) ? desc.cases[name] : undefined
}

function readCase(desc: Extract<Desc, { readonly kind: "union" }>, raw: unknown): AgentRead {
  if (typeof raw === "string" && caseOf(desc, raw)?.kind === "mark") return { ok: true, value: { [raw]: true } }
  if (typeof raw === "string" || typeof raw === "number") {
    const plain = caseOf(desc, desc.plain ?? undefined)
    const read = plain === undefined ? refused : readAgent(plain, raw)
    return read.ok && desc.plain !== null ? { ok: true, value: { [desc.plain]: read.value } } : refused
  }
  if (!plainObject(raw)) return refused
  const [name, ...rest] = Object.keys(raw)
  const item = caseOf(desc, name)
  if (name === undefined || item === undefined || item.kind === "mark" || rest.length > 0) return refused
  const read = readAgent(item, raw[name])
  return read.ok ? { ok: true, value: { [name]: read.value } } : refused
}

function readString(raw: unknown, holds: (text: string) => boolean): AgentRead {
  return typeof raw === "string" && holds(raw) ? { ok: true, value: raw } : refused
}

export function readAgent(desc: Desc, raw: unknown): AgentRead {
  switch (desc.kind) {
    case "number":
      return readNumber(desc, raw)
    case "flag":
      return typeof raw === "boolean" ? { ok: true, value: raw } : refused
    case "mark":
      return raw === true ? { ok: true, value: true } : refused
    case "words":
      return readString(raw, (text) => storableText(text) && bytesOf(text) <= desc.max)
    case "asset":
      return readString(raw, (text) => knownIcon(text) || (desc.media === true && webImage(text)))
    case "text":
      return readString(raw, storableText)
    case "link": {
      const value = readLinkTarget(raw)
      return value === null ? refused : { ok: true, value }
    }
    case "node":
      return readString(raw, (text) => readElementId(text) !== undefined)
    case "choice":
      return desc.custom !== undefined && typeof raw !== "string"
        ? readFields({ custom: desc.custom }, raw)
        : readString(raw, (text) => desc.options.includes(text))
    case "color": {
      const color = readAgentColor(raw)
      return color === null ? refused : { ok: true, value: color }
    }
    case "hex": {
      const hex = readAgentHex(raw)
      return hex === null ? refused : { ok: true, value: hex }
    }
    case "alpha":
      return refused
    case "record":
      return readFields(desc.fields, raw)
    case "list":
      return readItems(desc.item, raw, desc.min, desc.max)
    case "named":
      return readNamed(desc.item, raw, desc.max)
    case "union":
      return readCase(desc, raw)
  }
}

export function flat(schema: unknown): boolean {
  if (Array.isArray(schema)) return schema.every(flat)
  if (!plainObject(schema)) return true
  if (Object.hasOwn(schema, "oneOf") || Object.hasOwn(schema, "anyOf")) return false
  return Object.values(schema).every(flat)
}

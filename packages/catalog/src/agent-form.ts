import { readLinkTarget, type Desc, type NumberUnit } from "@airdesign/document"
import { bytesOf, readColor, readNodeId } from "@airdesign/doom"
import { knownIcon } from "./icon-names.js"
import { webImage } from "./image-address.js"
import { storableText } from "./storable-text.js"

const emuPerPoint = 12_700
const anglePerDegree = 60_000
const hundredthsPerPoint = 100

function tenths(value: number): number {
  return Math.round(value * 10) / 10
}

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

const agentHex = /^#[0-9A-Fa-f]{6}$/

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
      return readString(raw, (text) => readNodeId(text) !== undefined)
    case "choice":
      return desc.custom !== undefined && typeof raw !== "string"
        ? readFields({ custom: desc.custom }, raw)
        : readString(raw, (text) => desc.options.includes(text))
    case "color": {
      const color = readColor(raw)
      return color === undefined ? refused : { ok: true, value: color }
    }
    case "hex":
      return typeof raw === "string" && agentHex.test(raw) ? { ok: true, value: raw.slice(1).toUpperCase() } : refused
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

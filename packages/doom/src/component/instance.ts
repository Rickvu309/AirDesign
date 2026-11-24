import { readNodeId } from "../ids.js"
import { readPaint } from "../paint.js"
import { Reject, formed, list, literal, object, reject, variant } from "../read-kit.js"
import { textStyleNames } from "../text.js"
import { readData } from "./collections.js"
import { columnComponent } from "./library.js"
import { readChoices, readTokens, tokenRecord, variantRecord } from "./spec.js"
import { budget, id, isList } from "./values.js"

export type PartKey = readonly [string, ...string[]]

export function keyOf(raw: unknown): PartKey {
  if (!isList(raw) || raw.length === 0) return reject("shape", "A non-empty list of part key segments.")
  if (raw.length > 5) return reject("limit", "At most five part key segments.")
  return [id(raw[0]), ...raw.slice(1).map(id)]
}

export function readPartKey(raw: unknown): PartKey | undefined {
  try {
    return keyOf(raw)
  } catch (error) {
    if (error instanceof Reject) return undefined
    throw error
  }
}

export const keyString = (key: PartKey): string => JSON.stringify(key)

const baseline = variant("kind", {
  rect: object({ fills: list(readPaint, 16) }),
  text: object({ style: literal(textStyleNames) }),
  line: object({}),
})

const node = formed(readNodeId, "A node ID.")
const instance = object({
  component: object({
    id: literal(["column"]),
    revision: formed((raw) => (raw === 1 ? raw : undefined), "Column component revision 1."),
  }),
  variant: variantRecord,
  tokens: tokenRecord,
  data: (raw) => readData(columnComponent.collections, raw, budget(80_000, "At most 80,000 work units.")),
  generated: node,
  parts: list(object({ key: keyOf, node, baseline }), 499),
  suppressed: list(object({ key: keyOf, reason: literal(["delete"]) }), 499),
})

export type Instance = ReturnType<typeof instance>
export type PartBaseline = ReturnType<typeof baseline>

export function readInstance(raw: unknown): Instance {
  const found = instance(raw)
  readChoices(columnComponent, found.variant)
  readTokens(columnComponent, {}, found.tokens)
  if (found.parts.length + found.suppressed.length > 499) return reject("limit")
  const ids = new Set([found.generated])
  const keys = new Set([keyString(["root"])])
  for (const part of [...found.parts, ...found.suppressed]) {
    const key = keyString(part.key)
    if (keys.has(key)) return reject()
    keys.add(key)
    if ("node" in part) {
      if (ids.has(part.node)) return reject()
      ids.add(part.node)
    }
  }
  return found
}

export const instanceFields = ["data", "tokens", "variant"] as const
export type InstanceField = (typeof instanceFields)[number]
export type InstanceFieldKey = `instance.${InstanceField}`
export const instanceFieldKey = (field: InstanceField): InstanceFieldKey => `instance.${field}`
export const instanceFieldKeys: readonly InstanceFieldKey[] = instanceFields.map(instanceFieldKey)

import { readNodeId } from "../ids.js"
import { readPaint } from "../paint.js"
import { Reject, formed, integer, list, literal, object, reject, variant } from "../read-kit.js"
import { textStyleNames } from "../text.js"
import { resolveComponent } from "./library.js"
import { readChoices, readComponentData, readTokens, tokenRecord, variantRecord } from "./spec.js"
import { budget, id, isList, readFocus } from "./values.js"

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
  path: object({ fills: list(readPaint, 16) }),
  text: object({ style: literal(textStyleNames) }),
  line: object({}),
})

const node = formed(readNodeId, "A node ID.")
const storedInstance = object(
  {
    component: object({
      id,
      revision: integer(1, Number.MAX_SAFE_INTEGER),
    }),
    variant: variantRecord,
    tokens: tokenRecord,
    data: (raw) => raw,
    generated: node,
    parts: list(object({ key: keyOf, node, baseline }), 499),
    suppressed: list(object({ key: keyOf, reason: literal(["delete"]) }), 499),
  },
  { focus: readFocus },
)

export type Instance = Omit<ReturnType<typeof storedInstance>, "data" | "focus"> & {
  readonly focus: readonly string[]
  readonly data: ReturnType<typeof readComponentData>
}
export type PartBaseline = ReturnType<typeof baseline>

export const hasBaselineFill = (
  baseline: PartBaseline | undefined,
): baseline is Extract<PartBaseline, { kind: "rect" | "path" }> =>
  baseline?.kind === "rect" || baseline?.kind === "path"

export function readInstance(raw: unknown): Instance {
  const found = storedInstance(raw)
  const definition = resolveComponent(found.component)
  if (definition === undefined) return reject("shape", "A component ID and revision from the library.")
  const { spec } = definition
  const data = readComponentData(spec, found.data, budget(80_000, "At most 80,000 work units."))
  readChoices(spec, found.variant)
  readTokens(spec, {}, found.tokens)
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
  return { ...found, data, focus: found.focus ?? [] }
}

export const instanceFields = ["data", "tokens", "variant", "focus"] as const
export type InstanceField = (typeof instanceFields)[number]
export type InstanceFieldKey = `instance.${InstanceField}`
export const instanceFieldKey = (field: InstanceField): InstanceFieldKey => `instance.${field}`
export const instanceFieldKeys: readonly InstanceFieldKey[] = instanceFields.map(instanceFieldKey)

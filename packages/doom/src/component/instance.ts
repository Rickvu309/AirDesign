import { readNodeId, type NodeId } from "../ids.js"
import { readPaint } from "../paint.js"
import { Reject, formed, integer, list, literal, object, oneOf, reject, variant } from "../read-kit.js"
import { textStyleNames } from "../text.js"
import { resolveComponent } from "./library.js"
import { type ComponentSpec, readChoices, readComponentData, readTokens, tokenRecord, variantRecord } from "./spec.js"
import { budget, color, entries, id, isList, name, readFocus, scalar, type Value } from "./values.js"

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
const revision = integer(1, Number.MAX_SAFE_INTEGER)
export type ComponentRef = { readonly revision: number } & (
  | { readonly id: string; readonly node?: never }
  | { readonly node: NodeId; readonly id?: never }
)
const componentRef = oneOf<ComponentRef>(object({ id, revision }), object({ node, revision }))

const storedInstance = object(
  {
    component: componentRef,
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
  const ref = found.component
  const data = ref.node === undefined ? readLibraryInputs(ref, found) : readStoredData(found.data)
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

function readLibraryInputs(
  ref: { readonly id: string; readonly revision: number },
  found: ReturnType<typeof storedInstance>,
) {
  const definition = resolveComponent(ref)
  if (definition === undefined) return reject("shape", "A component ID and revision from the library.")
  return readInstanceInputs(definition.spec, found)
}

export function readInstanceInputs(
  spec: ComponentSpec,
  instance: Pick<ReturnType<typeof storedInstance>, "data" | "variant" | "tokens">,
): Instance["data"] {
  const data = readComponentData(spec, instance.data, budget(80_000, "At most 80,000 work units."))
  readChoices(spec, instance.variant)
  readTokens(spec, {}, instance.tokens)
  return data
}

function readStoredCell(raw: unknown): Value {
  return raw !== null && typeof raw === "object" ? color(raw) : scalar(raw)
}

function readStoredData(raw: unknown): Instance["data"] {
  const cell = oneOf<Value>(list(readStoredCell, 100), readStoredCell)
  return Object.fromEntries(
    entries(raw, 16).map(([table, rows]) => [
      name(table),
      list((rawRow) => {
        const row = Object.fromEntries(entries(rawRow, 17))
        return {
          ...Object.fromEntries(
            Object.entries(row)
              .filter(([key]) => key !== "id")
              .map(([key, value]) => [name(key), cell(value)]),
          ),
          id: id(row.id),
        }
      }, 100)(rows),
    ]),
  )
}

export const instanceFields = ["data", "tokens", "variant", "focus"] as const
export type InstanceField = (typeof instanceFields)[number]
export type InstanceFieldKey = `instance.${InstanceField}`
export const instanceFieldKey = (field: InstanceField): InstanceFieldKey => `instance.${field}`
export const instanceFieldKeys: readonly InstanceFieldKey[] = instanceFields.map(instanceFieldKey)

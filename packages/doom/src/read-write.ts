import { bytesOf, limits } from "./limits.js"
import { type NodeId, readNodeId, readRev } from "./ids.js"
import { type NodeType, type PropName, type WriteKey, accepts, nodeTypes, props } from "./props.js"
import { boolean, object, rejected, words, literal } from "./read-kit.js"
import { type Refusal, isRefusal, refuse } from "./refusal.js"
import type { Author, Edit, Doom, RunUndo, Write } from "./doom.js"
import { readThemeKey, readThemeValue } from "./theme.js"

export type Lookup = { readonly type: (node: NodeId) => NodeType | undefined }

const writeKeys = new Set(["node", "prop", "value", "base"])
const required: readonly PropName[] = ["type", "theme", "size"]

const plain = (raw: unknown): Record<string, unknown> | undefined =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined

export function readWriteKey(raw: unknown): WriteKey | undefined {
  if (typeof raw !== "string") return undefined
  return Object.hasOwn(props, raw) ? (raw as PropName) : readThemeKey(raw)
}

export const baseKey = (key: WriteKey): PropName => (key.startsWith("theme.") ? "theme" : (key as PropName))

function readValue(key: WriteKey, raw: unknown): unknown | Refusal {
  if (key.startsWith("theme.")) {
    try {
      return readThemeValue(key as never)(raw)
    } catch (thrown) {
      return { refused: rejected(thrown) }
    }
  }
  return props[key as PropName].read(raw)
}

export function readWriteIn(raw: unknown, lookup: Lookup): Write | Refusal {
  const found = plain(raw)
  if (found === undefined || Object.keys(found).some((key) => !writeKeys.has(key))) return refuse("shape")
  const node = readNodeId(found.node)
  if (node === undefined) return refuse("shape")
  const key = readWriteKey(found.prop)
  if (key === undefined || !Object.hasOwn(found, "value")) return refuse("shape", node)
  const base = Object.hasOwn(found, "base") ? readRev(found.base) : undefined
  if (Object.hasOwn(found, "base") && base === undefined) return refuse("shape", node, key)
  const made = { node, prop: key, ...(base === undefined ? {} : { base }) }
  const type = lookup.type(node)

  if (key === "type") {
    const value = found.value
    if (typeof value !== "string" || !(nodeTypes as readonly string[]).includes(value))
      return refuse("shape", node, key)
    return type === undefined || type === value ? { ...made, value } : refuse("shape", node, key)
  }
  if (type === undefined) return refuse("missing", node, key)
  if (!(accepts[type] as readonly PropName[]).includes(baseKey(key))) return refuse("shape", node, key)

  if (found.value === null && key !== "parent") {
    return required.includes(baseKey(key)) ? refuse("shape", node, key) : { ...made, value: null }
  }
  const value = readValue(key, found.value)
  if (isRefusal(value)) return refuse(value.refused, node, key)
  if (bytesOf(JSON.stringify(value)) >= limits.row) return refuse("limit", node, key)
  return { ...made, value }
}

export function readWrite(
  raw: unknown,
  doom: Doom,
  created: ReadonlyMap<NodeId, NodeType> = new Map(),
): Write | Refusal {
  return readWriteIn(raw, { type: (node) => created.get(node) ?? doom.nodes.get(node)?.type })
}

const readAuthor = object(
  { kind: literal(["person", "agent"]), id: words(limits.clientName, 1) },
  { run: words(limits.clientName, 1), name: words(limits.clientName, 1) },
)

const readRunUndo = object({ run: words(limits.clientName, 1), undone: boolean })

const editKeys = new Set(["once", "author", "writes", "phase", "runUndo"])

export function readEdit(raw: unknown, doom: Doom): Edit | Refusal {
  const found = plain(raw)
  if (found === undefined || Object.keys(found).some((key) => !editKeys.has(key))) return refuse("shape")
  let author: Author
  let once: string
  let runUndo: RunUndo | undefined
  try {
    author = readAuthor(found.author)
    once = words(128, 1)(found.once)
    runUndo = found.runUndo === undefined ? undefined : readRunUndo(found.runUndo)
  } catch (thrown) {
    return refuse(rejected(thrown))
  }
  const phase = found.phase
  if (phase !== undefined && phase !== "start" && phase !== "stop") return refuse("shape")
  if (!Array.isArray(found.writes) || (author.kind === "person" && (author.run ?? author.name) !== undefined))
    return refuse("shape")
  const created = new Map<NodeId, NodeType>()
  const writes: Write[] = []
  for (const each of found.writes) {
    const write = readWrite(each, doom, created)
    if (isRefusal(write)) return write
    if (write.prop === "type" && doom.nodes.get(write.node) === undefined)
      created.set(write.node, write.value as NodeType)
    writes.push(write)
  }
  if (
    runUndo !== undefined &&
    author.kind !== "person" &&
    !(author.kind === "agent" && author.run === runUndo.run && doom.runs.get(runUndo.run)?.agent === author.id)
  )
    return refuse("shape")
  return {
    once,
    author,
    writes,
    ...(phase === undefined ? {} : { phase }),
    ...(runUndo === undefined ? {} : { runUndo }),
  }
}

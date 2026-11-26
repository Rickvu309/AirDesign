import type { Doom, Write } from "./doom.js"
import { parentOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"

export type ParentFate = "restore" | "drop" | "pass"

const targetId = (write: Write): NodeId | undefined => {
  if (write.prop !== "parent" || write.value === null || typeof write.value !== "object") return undefined
  const id = (write.value as { readonly id?: unknown }).id
  return typeof id === "string" ? (id as NodeId) : undefined
}

const namesDelete = (doom: Doom, write: Write): boolean => {
  const at = doom.revs.get(write.node)?.get("parent")
  return write.base !== undefined && at !== undefined && write.base === at
}

export function parentLanding(doom: Doom, writes: readonly Write[], write: Write): ParentFate {
  const target = targetId(write)
  if (target === undefined) return "pass"
  const node = doom.nodes.get(write.node)
  if (node === undefined || parentOf(node) !== null) return "pass"
  if (namesDelete(doom, write)) return "restore"
  const parent = doom.nodes.get(target)
  if (parent === undefined) return writes.some((each) => each.node === target && each.prop === "type") ? "drop" : "pass"
  if (parentOf(parent) === null) return write.base === undefined ? "pass" : "drop"
  return "drop"
}

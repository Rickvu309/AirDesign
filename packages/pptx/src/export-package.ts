import { carryPackage } from "./package-carry.js"
import { carryParts, sameBytes } from "./package-bytes.js"
import { readPackage } from "./package-limits.js"

export function samePartBytes(
  expected: ReadonlyMap<string, Uint8Array>,
  actual: ReadonlyMap<string, Uint8Array>,
): boolean {
  if (expected.size !== actual.size) return false
  for (const [name, data] of expected) {
    const found = actual.get(name)
    if (found === undefined || !sameBytes(found, data)) return false
  }
  return true
}

export async function exportPackage(original: Uint8Array, parts: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const carried = carryParts(parts)
  const written = await carryPackage(original, carried)
  const read = await readPackage(written)
  if (!read.ok) throw new Error(read.reason === "limit" ? read.limit : read.reason)
  if (!samePartBytes(carried, read.parts)) throw new Error("part")
  return written
}

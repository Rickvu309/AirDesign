import { carryParts, writeParts } from "./package-bytes.js"
import { readPackage } from "./package-limits.js"

export function samePartBytes(
  expected: ReadonlyMap<string, Uint8Array>,
  actual: ReadonlyMap<string, Uint8Array>,
): boolean {
  if (expected.size !== actual.size) return false
  for (const [name, data] of expected) {
    const found = actual.get(name)
    if (found === undefined || found.length !== data.length) return false
    for (let index = 0; index < data.length; index += 1) {
      const left = data[index]
      const right = found[index]
      if (left === undefined || right === undefined || left !== right) return false
    }
  }
  return true
}

export async function exportPackage(parts: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const carried = carryParts(parts)
  const written = await writeParts(carried)
  const read = await readPackage(written)
  if (!read.ok) throw new Error(read.reason === "limit" ? read.limit : read.reason)
  if (!samePartBytes(carried, read.parts)) throw new Error("part")
  return written
}

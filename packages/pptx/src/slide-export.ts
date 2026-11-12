import { sameBytes } from "./package-bytes.js"

export function slideExportFailures(
  original: ReadonlyMap<string, Uint8Array>,
  exported: ReadonlyMap<string, Uint8Array>,
  kept: readonly string[],
): readonly string[] {
  const failures: string[] = []
  for (const name of kept) {
    const before = original.get(name)
    const after = exported.get(name)
    if (before === undefined || after === undefined || !sameBytes(before, after)) failures.push(name)
  }
  return failures
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

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

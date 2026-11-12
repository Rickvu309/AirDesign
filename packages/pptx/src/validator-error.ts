function copiedLine(line: string, source: string, copy: string): string | null {
  const named = ` /${source}`
  const at = line.endsWith(named) ? line.length - named.length : line.lastIndexOf(`${named} @ `)
  if (at < 0) return null
  return `${line.slice(0, at)} /${copy}${line.slice(at + named.length)}`
}

export function newValidatorErrors(
  original: readonly string[],
  edited: readonly string[],
  copies: ReadonlyMap<string, string> = new Map(),
): readonly string[] {
  const expected = [...original]
  for (const [copy, source] of copies) {
    for (const line of original) {
      const copied = copiedLine(line, source, copy)
      if (copied !== null) expected.push(copied)
    }
  }
  const remaining = new Map<string, number>()
  for (const error of expected) remaining.set(error, (remaining.get(error) ?? 0) + 1)
  const extra: string[] = []
  for (const error of edited) {
    const left = remaining.get(error) ?? 0
    if (left > 0) remaining.set(error, left - 1)
    else extra.push(error)
  }
  return extra
}

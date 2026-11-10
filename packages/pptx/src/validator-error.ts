export function newValidatorErrors(original: readonly string[], edited: readonly string[]): readonly string[] {
  const remaining = new Map<string, number>()
  for (const error of original) remaining.set(error, (remaining.get(error) ?? 0) + 1)
  const extra: string[] = []
  for (const error of edited) {
    const left = remaining.get(error) ?? 0
    if (left > 0) remaining.set(error, left - 1)
    else extra.push(error)
  }
  return extra
}

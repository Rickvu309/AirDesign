export function newValidatorErrors(original: readonly string[], edited: readonly string[]): readonly string[] {
  const known = new Set(original)
  return edited.filter((error) => !known.has(error))
}

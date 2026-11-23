export function fieldsOf(raw: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

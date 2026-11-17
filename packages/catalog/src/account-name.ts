export const accountNameLimit = 100

export function readAccountName(
  raw: unknown,
): { readonly ok: true; readonly name: string } | { readonly ok: false; readonly refusal: "field" } {
  if (typeof raw !== "object" || raw === null || !("name" in raw) || typeof raw.name !== "string")
    return { ok: false, refusal: "field" }
  const name = raw.name.trim()
  if (
    name.length === 0 ||
    name.length > accountNameLimit ||
    [...name].some((letter) => letter.charCodeAt(0) < 32 || letter.charCodeAt(0) === 127)
  )
    return { ok: false, refusal: "field" }
  return { ok: true, name }
}

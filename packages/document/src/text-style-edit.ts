import { landedPatch, type NodeRegister } from "./decide.js"
import { textStyleLimit } from "./trait-theme.js"

export type TextStyleEdit = {
  readonly id: string
  readonly size: number
  readonly font: string
}

function isEdit(value: unknown): value is TextStyleEdit {
  if (typeof value !== "object" || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.id === "string" && typeof row.size === "number" && typeof row.font === "string"
}

export function storedTextStyleEdits(body: NodeRegister | undefined): readonly TextStyleEdit[] {
  if (body === undefined) return []
  const field = landedPatch(body, "text").theme?.textStyle
  if (typeof field !== "object" || !("set" in field) || !Array.isArray(field.set)) return []
  return field.set.filter(isEdit)
}

export function mergeTextStyleEdits(
  prior: readonly TextStyleEdit[] | undefined,
  edit: unknown,
): readonly TextStyleEdit[] | "too-many" | undefined {
  if (typeof edit !== "object" || edit === null || !("set" in edit) || !Array.isArray(edit.set)) return undefined
  const merged = [...(prior ?? [])]
  for (const item of edit.set) {
    if (!isEdit(item)) continue
    const at = merged.findIndex((each) => each.id === item.id)
    if (at < 0) merged.push(item)
    else merged[at] = item
  }
  return merged.length > textStyleLimit ? "too-many" : merged
}

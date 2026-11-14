import { designKeys, type Design } from "@airdesign/document"

export function printDesign(design: Design): string {
  return designKeys
    .flatMap((key) => {
      const shown = design[key]
      if (shown === undefined) return []
      const [value, source] = shown
      const field = value === true ? key : `${key} ${String(value)}`
      return [source === undefined ? field : `${field} (${source})`]
    })
    .join(" · ")
}

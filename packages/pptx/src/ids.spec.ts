import { markupDocument } from "./element-span.js"
export function sectionIds(parts: ReadonlyMap<string, Uint8Array>): string[] {
  const bytes = parts.get("ppt/presentation.xml")
  if (bytes === undefined) throw new Error("part")
  return markupDocument(bytes)
    .elements.filter((element) => element.kind === "p14:section" && element.id !== null)
    .sort((left, right) => left.start - right.start)
    .flatMap((element) => (element.id === null ? [] : [element.id]))
}

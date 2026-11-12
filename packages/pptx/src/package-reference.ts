import { markupDocument, type MarkupElement } from "./element-span.js"
import { contentTypesPart, partOf } from "./package-address.js"

export type PackageReference = {
  readonly part: string
  readonly kind: "Relationship" | "Types"
  readonly id: string
}

function value(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function sourceOf(rels: string): string | null {
  const marker = "_rels/"
  const at = rels.lastIndexOf(marker)
  if (at < 0 || !rels.endsWith(".rels")) return null
  return `${rels.slice(0, at)}${rels.slice(at + marker.length, rels.length - 5)}`
}

function decoded(part: string): string {
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}

function missingTargets(parts: ReadonlyMap<string, Uint8Array>): readonly PackageReference[] {
  const rows: PackageReference[] = []
  for (const [name, bytes] of parts) {
    const source = sourceOf(name)
    if (source === null) continue
    for (const element of markupDocument(bytes).elements) {
      if (element.kind !== "Relationship" || value(element, "TargetMode") === "External") continue
      const target = value(element, "Target")
      if (target === null || target === "" || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue
      const part = partOf(source, target.split("#")[0] ?? "")
      if (!parts.has(part) && !parts.has(decoded(part))) {
        rows.push({ part: name, kind: "Relationship", id: value(element, "Id") ?? "" })
      }
    }
  }
  return rows
}

function untypedParts(parts: ReadonlyMap<string, Uint8Array>): readonly PackageReference[] {
  const types = parts.get(contentTypesPart)
  if (types === undefined) return []
  const defaults = new Set<string>()
  const overrides = new Set<string>()
  for (const element of markupDocument(types).elements) {
    const extension = element.kind === "Default" ? value(element, "Extension") : null
    if (extension !== null) defaults.add(extension.toLowerCase())
    const part = element.kind === "Override" ? value(element, "PartName") : null
    if (part !== null) overrides.add(part.replace(/^\//, "").toLowerCase())
  }
  const rows: PackageReference[] = []
  for (const name of parts.keys()) {
    if (name === contentTypesPart || name.endsWith("/")) continue
    const extension = /\.([^./]+)$/.exec(name)?.[1]?.toLowerCase() ?? ""
    if (!overrides.has(name.toLowerCase()) && !defaults.has(extension)) {
      rows.push({ part: name, kind: "Types", id: extension })
    }
  }
  return rows
}

export function danglingPackageReferences(parts: ReadonlyMap<string, Uint8Array>): readonly PackageReference[] {
  return [...missingTargets(parts), ...untypedParts(parts)]
}

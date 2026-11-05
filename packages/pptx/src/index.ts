import path from "node:path"
import { createHash } from "node:crypto"
import { readArchive, writeArchive } from "./archive.ts"
import { parseXml, escapeXml, type XmlNode } from "./xml.ts"
import { inspectFont, rejectActiveSvg, safePartName, fileLimits } from "../../files/src/index.ts"

const relationshipsUri = "http://schemas.openxmlformats.org/package/2006/relationships"
const drawingUri = "http://schemas.openxmlformats.org/drawingml/2006/main"
export const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex")
export type Relationship = { part: string; id: string; type: string; target: string }
export type SafetyRemoval = { part: string; reason: "remote-external-relationships" | "macros" | "active-embedded-objects"; detail: string }
export type Capability = { scope: { kind: "part" } | { kind: "text-span"; index: number }; part: string; support: "native" | "kept" | "flagged"; local: "proven"; powerpoint: "unproven"; preview: null; sourceSha256: string; editor: "text-span" | "qualified-generated" | null }
export type Report = { sourceSha256: string; hashes: Record<string,string>; relationships: Relationship[]; removals: SafetyRemoval[]; capabilities: Capability[]; fonts: { family: string; status: "unresolved"; fileHash: null; license: null }[]; referenceGate: "P09-X01-unproven" }
export type Presentation = { parts: ReadonlyMap<string, Buffer>; report: Report }

function sourceOfRelationships(name: string): string {
  if (name === "_rels/.rels") return ""
  const match = /^(.*)\/_rels\/([^/]+)\.rels$/.exec(name)
  if (!match?.[1] || !match[2]) throw new Error("invalid-relationship-part")
  return `${match[1]}/${match[2]}`
}
function targetPart(source: string, target: string): string {
  if (/[:%\\?#\0]/.test(target)) throw new Error("unsafe-relationship-target")
  const resolved = target.startsWith("/") ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(source), target))
  if (!safePartName(resolved)) throw new Error("relationship-traversal")
  return resolved
}
function removeSpans(xml: string, nodes: XmlNode[]): string {
  let output = xml
  const disjoint = nodes.filter(node => !nodes.some(parent => parent !== node && parent.start <= node.start && parent.end >= node.end))
  for (const node of disjoint.sort((a,b) => b.start-a.start)) output = output.slice(0,node.start) + output.slice(node.end)
  return output
}

async function inertWorkbook(bytes: Buffer): Promise<boolean> {
  try {
    const parts = await readArchive(bytes)
    if (!parts.has("xl/workbook.xml") || !parts.has("[Content_Types].xml")) return false
    for (const [name, payload] of parts) {
      if (/vbaProject|activeX|embeddings/i.test(name)) return false
      if (!/\.(xml|rels)$/.test(name)) continue
      const parsed = parseXml(payload)
      if (name.endsWith(".rels")) for (const node of parsed.nodes.filter(node => node.local === "Relationship")) {
        if (node.attributes.TargetMode === "External" || /\/(?:vbaProject|oleObject|control|package)$/.test(node.attributes.Type ?? "")) return false
        const target = targetPart(sourceOfRelationships(name), node.attributes.Target ?? "")
        if (!parts.has(target)) return false
      }
    }
    return true
  } catch { return false }
}

export async function importPptx(input: Buffer): Promise<Presentation> {
  const parts = await readArchive(input)
  if (!parts.has("[Content_Types].xml") || !parts.has("_rels/.rels") || !parts.has("ppt/presentation.xml")) throw new Error("opc-presentation-required")
  const contentTypes = parseXml(parts.get("[Content_Types].xml") ?? Buffer.alloc(0))
  const defaults = new Map<string, string>()
  const overrides = new Map<string, string>()
  for (const node of contentTypes.nodes) {
    if (node.uri !== "http://schemas.openxmlformats.org/package/2006/content-types") continue
    const type = node.attributes.ContentType?.toLowerCase()
    if (!type) continue
    if (node.local === "Default" && node.attributes.Extension) defaults.set(node.attributes.Extension.toLowerCase(), type)
    if (node.local === "Override" && node.attributes.PartName) overrides.set(node.attributes.PartName.replace(/^\//, ""), type)
  }
  const original = new Map(parts)
  const removals: SafetyRemoval[] = []
  const relationships: Relationship[] = []
  const removed = new Set<string>()
  const workbooks = new Set<string>()
  for (const [name, bytes] of parts) if (name.startsWith("ppt/embeddings/") && name.endsWith(".xlsx") && await inertWorkbook(bytes)) workbooks.add(name)
  let nodesSeen = 0
  for (const [name, bytes] of parts) {
    if (/\.(xml|rels)$/i.test(name)) { nodesSeen += parseXml(bytes).nodes.length; if (nodesSeen > fileLimits.nodes) throw new Error("xml-job-node-limit") }
    if (/\.(ttf|otf|woff2?|fntdata|odttf)$/i.test(name)) inspectFont(bytes)
    if (/\.svg$/i.test(name) || (overrides.get(name) ?? defaults.get(path.posix.extname(name).slice(1).toLowerCase())) === "image/svg+xml") rejectActiveSvg(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    if (/vbaProject|activeX|\/embeddings\//i.test(name) && !workbooks.has(name)) {
      removed.add(name)
      removals.push({ part: name, reason: /vbaProject/i.test(name) ? "macros" : "active-embedded-objects", detail: "payload removed" })
    }
  }
  for (const [name, bytes] of parts) {
    if (!name.endsWith(".rels")) continue
    const source = sourceOfRelationships(name)
    if (source && !parts.has(source)) throw new Error("orphan-relationship-part")
    const parsed = parseXml(bytes)
    const drops: XmlNode[] = []
    const ids = new Set<string>()
    for (const node of parsed.nodes.filter(node => node.local === "Relationship" && node.uri === relationshipsUri)) {
      const id = node.attributes.Id
      const type = node.attributes.Type
      const target = node.attributes.Target
      if (!id || !type || !target || ids.has(id)) throw new Error("invalid-relationship")
      ids.add(id)
      const external = node.attributes.TargetMode === "External"
      if (node.attributes.TargetMode && !external && node.attributes.TargetMode !== "Internal") throw new Error("invalid-target-mode")
      const resolved = external ? target : targetPart(source, target)
      const active = /\/(?:oleObject|vbaProject|control|activeXControlBinary)$/.test(type) || (type.endsWith("/package") && !(source.startsWith("ppt/charts/") && workbooks.has(resolved)))
      if (external || active || removed.has(resolved)) {
        drops.push(node)
        removals.push({ part: name, reason: external ? "remote-external-relationships" : /vbaProject/.test(type) ? "macros" : "active-embedded-objects", detail: id })
        if (active && !external) removed.add(resolved)
        const sourceBytes = parts.get(source)
        if (sourceBytes) {
          const parsedSource = parseXml(sourceBytes)
          const references = parsedSource.nodes.filter(item => Object.entries(item.attributes).some(([key,value]) => key.includes(":") && ["id","embed","link"].includes(key.split(":")[1] ?? "") && value === id))
          parts.set(source, Buffer.from(removeSpans(parsedSource.xml, references)))
        }
      } else {
        if (!parts.has(resolved)) throw new Error(`relationship-target-missing:${resolved}`)
        relationships.push({ part: source, id, type, target: resolved })
      }
    }
    if (drops.length) parts.set(name, Buffer.from(removeSpans(parsed.xml, drops)))
  }
  for (const name of removed) { parts.delete(name); const rel = `${path.posix.dirname(name)}/_rels/${path.posix.basename(name)}.rels`; parts.delete(rel) }
  const types = parts.get("[Content_Types].xml")
  if (!types) throw new Error("content-types-required")
  const parsedTypes = parseXml(types)
  const typeDrops = parsedTypes.nodes.filter(node => node.local === "Override" && removed.has((node.attributes.PartName ?? "").replace(/^\//,"")))
  if (typeDrops.length) parts.set("[Content_Types].xml", Buffer.from(removeSpans(parsedTypes.xml,typeDrops)))
  for (const rel of relationships) if (parts.has(rel.part) && !parts.has(rel.target)) throw new Error("security-removal-broke-closure")
  const fonts = new Set<string>()
  const capabilities: Capability[] = []
  for (const [name, bytes] of parts) {
    const spans: number[] = []
    if (name.endsWith(".xml")) {
      const parsed = parseXml(bytes)
      for (const node of parsed.nodes) if (["latin","ea","cs"].includes(node.local) && node.attributes.typeface) fonts.add(node.attributes.typeface)
      for (const [index] of parsed.nodes.filter(node => node.uri === drawingUri && node.local === "t").entries()) spans.push(index)
    }
    const source = original.get(name)
    capabilities.push({ scope: { kind: "part" }, part: name, support: "kept", local: "proven", powerpoint: "unproven", preview: null, sourceSha256: hash(source ?? bytes), editor: null })
    for (const index of spans) capabilities.push({ scope: { kind: "text-span", index }, part: name, support: "native", local: "proven", powerpoint: "unproven", preview: null, sourceSha256: hash(source ?? bytes), editor: "text-span" })
  }
  for (const removal of removals) if (!capabilities.some(item => item.part === removal.part && item.support === "flagged")) capabilities.push({ scope: { kind: "part" }, part: removal.part, support: "flagged", local: "proven", powerpoint: "unproven", preview: null, sourceSha256: hash(original.get(removal.part) ?? Buffer.alloc(0)), editor: null })
  return { parts, report: { sourceSha256: hash(input), hashes: Object.fromEntries([...original].map(([name,bytes]) => [name,hash(bytes)])), relationships: relationships.filter(rel => !removed.has(rel.part)), removals, capabilities, fonts: [...fonts].map(family => ({ family, status: "unresolved", fileHash: null, license: null })), referenceGate: "P09-X01-unproven" } }
}

export async function exportPptx(presentation: Presentation): Promise<Buffer> { return writeArchive(presentation.parts) }
export function patchText(presentation: Presentation, part: string, index: number, text: string): Presentation {
  const bytes = presentation.parts.get(part)
  if (!bytes) throw new Error("part-not-found")
  const parsed = parseXml(bytes)
  const node = parsed.nodes.filter(node => node.uri === drawingUri && node.local === "t")[index]
  if (!node || node.closeStart < node.openEnd || parsed.nodes.some(child => child.start > node.start && child.end < node.end)) throw new Error("qualified-text-span-required")
  const parts = new Map(presentation.parts)
  const selfClosing = parsed.xml.slice(node.start, node.openEnd).endsWith("/>")
  const replacement = selfClosing
    ? parsed.xml.slice(node.start, node.openEnd - 2).trimEnd() + ">" + escapeXml(text) + `</${node.name}>`
    : parsed.xml.slice(node.start, node.openEnd) + escapeXml(text) + parsed.xml.slice(node.closeStart, node.end)
  parts.set(part, Buffer.from(parsed.xml.slice(0,node.start) + replacement + parsed.xml.slice(node.end)))
  parseXml(parts.get(part) ?? Buffer.alloc(0))
  return { ...presentation, parts }
}

export function moveKept(presentation: Presentation, part: string, objectId: string, x: number, y: number): Presentation {
  if (![x,y].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error("invalid-placement")
  const bytes = presentation.parts.get(part)
  if (!bytes) throw new Error("part-not-found")
  const parsed = parseXml(bytes)
  const identity = parsed.nodes.find(node => node.local === "cNvPr" && node.attributes.id === objectId)
  const frame = identity && parsed.nodes.filter(node => ["sp","graphicFrame","pic","grpSp"].includes(node.local) && node.start < identity.start && node.end > identity.end).sort((a,b) => (a.end-a.start)-(b.end-b.start))[0]
  const offset = frame && parsed.nodes.find(node => node.uri === drawingUri && node.local === "off" && node.start > frame.start && node.end < frame.end)
  if (!offset) throw new Error("qualified-placement-required")
  const replacement = `<${offset.name} x="${x}" y="${y}"/>`
  const parts = new Map(presentation.parts)
  parts.set(part, Buffer.from(parsed.xml.slice(0,offset.start)+replacement+parsed.xml.slice(offset.end)))
  return { ...presentation, parts }
}

export function copyDependency(presentation: Presentation, source: string, destination: string, relationshipPart: string, id: string): Presentation {
  const bytes = presentation.parts.get(source)
  const relBytes = presentation.parts.get(relationshipPart)
  if (!bytes || !relBytes || !safePartName(destination) || presentation.parts.has(destination)) throw new Error("invalid-copy-on-write")
  const parsed = parseXml(relBytes)
  const node = parsed.nodes.find(node => node.local === "Relationship" && node.attributes.Id === id)
  if (!node || targetPart(sourceOfRelationships(relationshipPart), node.attributes.Target ?? "") !== source) throw new Error("dependency-reference-required")
  const relative = path.posix.relative(path.posix.dirname(sourceOfRelationships(relationshipPart)),destination)
  const replacement = `<${node.name} Id="${escapeXml(id)}" Type="${escapeXml(node.attributes.Type ?? "")}" Target="${escapeXml(relative)}"/>`
  const parts = new Map(presentation.parts)
  if (path.posix.dirname(source) !== path.posix.dirname(destination) || path.posix.extname(source) !== path.posix.extname(destination)) throw new Error("copy-requires-same-directory-and-type")
  parts.set(destination, Buffer.from(bytes))
  const dependencyRelationships = `${path.posix.dirname(source)}/_rels/${path.posix.basename(source)}.rels`
  const copiedRelationships = `${path.posix.dirname(destination)}/_rels/${path.posix.basename(destination)}.rels`
  const dependencyBytes = parts.get(dependencyRelationships)
  if (parts.has(copiedRelationships)) throw new Error("copy-relationship-collision")
  if (dependencyBytes) parts.set(copiedRelationships, Buffer.from(dependencyBytes))
  const types = parts.get("[Content_Types].xml")
  if (!types) throw new Error("content-types-required")
  const parsedTypes = parseXml(types)
  const override = parsedTypes.nodes.find(item => item.local === "Override" && item.attributes.PartName === `/${source}`)
  const root = parsedTypes.nodes[0]
  if (override && root) {
    const copiedType = parsedTypes.xml.slice(override.start,override.end).replace(`/${source}`, `/${destination}`)
    parts.set("[Content_Types].xml", Buffer.from(parsedTypes.xml.slice(0,root.closeStart) + copiedType + parsedTypes.xml.slice(root.closeStart)))
  }
  parts.set(relationshipPart, Buffer.from(parsed.xml.slice(0,node.start)+replacement+parsed.xml.slice(node.end)))
  return { ...presentation, parts }
}

export function patchTableCell(presentation: Presentation, part: string, tableIndex: number, rowIndex: number, columnIndex: number, value: string): Presentation {
  const bytes = presentation.parts.get(part)
  if (!bytes) throw new Error("table-part-required")
  const parsed = parseXml(bytes)
  const table = parsed.nodes.filter(node => node.uri === drawingUri && node.local === "tbl")[tableIndex]
  const row = table && parsed.nodes.filter(node => node.local === "tr" && node.uri === drawingUri && node.start > table.start && node.end < table.end)[rowIndex]
  const cell = row && parsed.nodes.filter(node => node.local === "tc" && node.uri === drawingUri && node.start > row.start && node.end < row.end)[columnIndex]
  const spans = parsed.nodes.filter(node => node.uri === drawingUri && node.local === "t")
  const text = cell && spans.filter(node => node.start > cell.start && node.end < cell.end)
  if (!text || text.length !== 1 || !text[0]) throw new Error("single-span-table-cell-required")
  return patchText(presentation,part,spans.indexOf(text[0]),value)
}

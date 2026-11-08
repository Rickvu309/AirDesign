import { parseXml } from "./xml.ts"
import { rejectActiveSvg, safePartName } from "../../files/src/index.ts"
import type { SafetyRemoval } from "./index.ts"

const historyPart = "airdesign/security-removals.json"
const reasons = new Set(["remote-external-relationships", "macros", "active-embedded-objects", "inert-office-processing-instruction", "inert-svg-attributes"])
export function readSafetyHistory(parts: ReadonlyMap<string, Buffer>): SafetyRemoval[] {
  const bytes = parts.get(historyPart)
  if (!bytes) return []
  if (bytes.length > 8 * 1024 * 1024) throw new Error("safety-history-limit")
  const value: unknown = JSON.parse(bytes.toString("utf8"))
  if (!Array.isArray(value) || value.length > 10000 || !value.every(item => typeof item === "object" && item !== null && typeof item.part === "string" && safePartName(item.part) && reasons.has(item.reason) && item.disposition === (item.reason === "inert-office-processing-instruction" || item.reason === "inert-svg-attributes" ? "normalized" : "removed") && (item.affectedObjects === undefined || Array.isArray(item.affectedObjects) && item.affectedObjects.length <= 10000 && item.affectedObjects.every((object: unknown) => typeof object === "object" && object !== null && "part" in object && typeof object.part === "string" && safePartName(object.part) && "objectId" in object && typeof object.objectId === "string" && object.objectId.length <= 128 && "content" in object && (object.content === "removed" || object.content === "preserved"))) && typeof item.detail === "string" && item.detail.length <= 4096)) throw new Error("invalid-safety-history")
  return value
}
export function storeSafetyHistory(parts: Map<string, Buffer>, removals: SafetyRemoval[]): void {
  if (!removals.length) return
  parts.set(historyPart, Buffer.from(JSON.stringify(removals)))
  const bytes = parts.get("[Content_Types].xml")
  if (!bytes) throw new Error("content-types-required")
  const parsed = parseXml(bytes)
  if (parsed.nodes.some(node => node.attributes.PartName === `/${historyPart}`)) return
  const root = parsed.nodes[0]
  if (!root || root.local !== "Types") throw new Error("content-types-required")
  parts.set("[Content_Types].xml", Buffer.from(parsed.xml.slice(0, root.closeStart) + `<Override PartName="/${historyPart}" ContentType="application/json"/>` + parsed.xml.slice(root.closeStart)))
}
export function normalizeImportPart(part: string, bytes: Buffer): { bytes: Buffer; removals: SafetyRemoval[] } {
  const removals: SafetyRemoval[] = []
  if (/^customXml\/item[0-9]+\.xml$/.test(part)) {
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    if (xml.startsWith("<?mso-contentType?>")) {
      const normalized = xml.slice("<?mso-contentType?>".length)
      const parsed = parseXml(Buffer.from(normalized))
      if (parsed.nodes[0]?.local !== "FormTemplates" || parsed.nodes[0]?.uri !== "http://schemas.microsoft.com/sharepoint/v3/contenttype/forms") throw new Error("unqualified-office-processing-instruction")
      bytes = Buffer.from(normalized)
      removals.push({ disposition: "normalized", part, reason: "inert-office-processing-instruction", detail: "Removed empty mso-contentType instruction; retained SharePoint form metadata" })
    }
  }
  if (/^ppt\/media\/[^/]+\.svg$/.test(part)) {
    const parsed = parseXml(bytes)
    let xml = parsed.xml
    const root = parsed.nodes[0]
    if (root?.local === "svg" && root.uri === "http://www.w3.org/2000/svg") {
      let opening = xml.slice(root.start, root.openEnd)
      const names: string[] = []
      if (root.attributes.id && /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(root.attributes.id)) names.push("id")
      if (root.attributes.overflow === "hidden") names.push("overflow")
      for (const name of names) opening = opening.replace(new RegExp(`\\s${name}=(?:"[^"]*"|'[^']*')`), "")
      xml = xml.slice(0, root.start) + opening + xml.slice(root.openEnd)
      rejectActiveSvg(xml)
      if (names.length) {
        bytes = Buffer.from(xml)
        removals.push({ disposition: "normalized", part, reason: "inert-svg-attributes", detail: `Removed root attributes ${names.join(", ")}; retained strictly sanitized SVG geometry` })
      }
    }
  }
  return { bytes, removals }
}

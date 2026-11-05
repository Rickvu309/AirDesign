import { performanceBudgets } from "../../contract-rules/src/budgets.ts"

export const fileLimits = {
  compressed: performanceBudgets.workerZipBytes,
  expanded: performanceBudgets.workerUnpackedBytes,
  parts: performanceBudgets.workerParts,
  xml: 8 * 1024 * 1024,
  binary: 64 * 1024 * 1024,
  ratio: 100,
  depth: 128,
  nodes: 500_000,
  attributes: 256,
} as const

export function safePartName(name: string): boolean {
  return name.length > 0 && !/[<>"'&?#]/u.test(name) && ![...name].some(character => character.charCodeAt(0) <= 32) && !name.startsWith("/") && !name.includes("\\") && !name.includes("%") && !name.includes("\0") && !name.split("/").some(segment => segment === ".." || segment === "." || segment === "") && !name.includes(":")
}

export function requireLocalUpload(value: unknown): Buffer {
  if (typeof value !== "object" || value === null || !("base64" in value) || typeof value.base64 !== "string" || Object.keys(value).some(key => key !== "base64" && key !== "requestId")) throw new Error("local-upload-required-no-paths-or-urls")
  if (value.base64.length > Math.ceil(fileLimits.compressed / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64)) throw new Error("upload-limit-or-invalid-base64")
  const input = Buffer.from(value.base64, "base64")
  if (input.length < 4 || input.length > fileLimits.compressed || input.readUInt32LE(0) !== 0x04034b50) throw new Error("pptx-upload-required")
  return input
}

export function rejectActiveSvg(xml: string): void {
  if (/<(?:[^:<> ]+:)?(?:script|style|animate|animateMotion|animateTransform|set|audio|video|handler|object|embed|link|meta|foreignObject|iframe|image|use)\b|\bon[a-z]+\s*=|(?:href|src)\s*=|url\s*\(|<!DOCTYPE|<!ENTITY|<\?/i.test(xml)) throw new Error("unsafe-svg")
}

export function inspectFont(bytes: Buffer): { tables: number; rendererUse: "unqualified" } {
  if (bytes.length < 12 || bytes.length > fileLimits.binary) throw new Error("hostile-font")
  const signature = bytes.readUInt32BE(0)
  if (signature !== 0x00010000 && signature !== 0x4f54544f) throw new Error("font-format-unqualified")
  const count = bytes.readUInt16BE(4)
  if (count === 0 || count > 128 || 12 + count * 16 > bytes.length) throw new Error("hostile-font-directory")
  const tables: { name: string; start: number; end: number }[] = []
  for (let index = 0; index < count; index++) {
    const offset = 12 + index * 16
    const name = bytes.toString("ascii", offset, offset + 4)
    const start = bytes.readUInt32BE(offset + 8)
    const end = start + bytes.readUInt32BE(offset + 12)
    if (start < 12 + count * 16 || start % 4 !== 0 || end > bytes.length || tables.some(table => table.name === name || (start < table.end && end > table.start))) throw new Error("hostile-font-table")
    tables.push({ name, start, end })
  }
  if (!tables.some(table => table.name === "head") || !tables.some(table => table.name === "cmap")) throw new Error("hostile-font-required-tables")
  return { tables: count, rendererUse: "unqualified" }
}

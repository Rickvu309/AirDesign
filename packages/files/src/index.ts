import { SaxesParser } from "saxes"
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
  if (value.base64.length > Math.ceil(fileLimits.compressed / 3) * 4 || (value.base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(value.base64) || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.base64))) throw new Error("upload-limit-or-invalid-base64")
  const input = Buffer.from(value.base64, "base64")
  if (input.length < 4 || input.length > fileLimits.compressed || input.readUInt32LE(0) !== 0x04034b50) throw new Error("pptx-upload-required")
  return input
}

const svgElements = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "title", "desc"])
const svgNumbers = new Set(["x", "y", "x1", "x2", "y1", "y2", "width", "height", "rx", "ry", "r", "cx", "cy", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "font-size"])
function safeSvgValue(name: string, value: string): boolean {
  if (value.length > 4096) return false
  if (svgNumbers.has(name)) return /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[+-]?[0-9]+)?%?$/i.test(value)
  if (name === "fill" || name === "stroke") return /^(?:none|transparent|currentColor|black|white|red|green|blue|#[a-f0-9]{3,8})$/i.test(value)
  if (name === "d") return /^[MmZzLlHhVvCcSsQqTtAa0-9eE+., -]*$/.test(value)
  if (name === "points" || name === "viewBox") return /^[0-9eE+., -]+$/.test(value)
  if (name === "transform") return /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([0-9eE+., -]+\)\s*)+$/.test(value)
  if (name === "fill-rule") return ["nonzero", "evenodd"].includes(value)
  if (name === "stroke-linecap") return ["butt", "round", "square"].includes(value)
  if (name === "stroke-linejoin") return ["miter", "round", "bevel"].includes(value)
  if (name === "text-anchor") return ["start", "middle", "end"].includes(value)
  return false
}
export function rejectActiveSvg(xml: string): void {
  const unsafe = () => { throw new Error("unsafe-svg") }
  if (Buffer.byteLength(xml) > fileLimits.xml || /<!DOCTYPE|<!ENTITY/i.test(xml)) unsafe()
  const parser = new SaxesParser({ xmlns: true })
  let depth = 0
  let nodes = 0
  parser.on("error", unsafe)
  parser.on("doctype", unsafe)
  parser.on("processinginstruction", unsafe)
  parser.on("opentag", tag => {
    if (++depth > fileLimits.depth || ++nodes > fileLimits.nodes || !svgElements.has(tag.local) || tag.uri !== "http://www.w3.org/2000/svg" || (nodes === 1 && tag.local !== "svg") || Object.keys(tag.attributes).length > fileLimits.attributes) unsafe()
    for (const attribute of Object.values(tag.attributes)) {
      if (attribute.uri === "http://www.w3.org/2000/xmlns/") continue
      if (attribute.uri) unsafe()
      if (attribute.name === "style") {
        for (const declaration of attribute.value.split(";").filter(value => value.trim())) {
          const [name, value, extra] = declaration.split(":")
          if (extra !== undefined || !name || !value || !safeSvgValue(name.trim(), value.trim())) unsafe()
        }
      } else if (!safeSvgValue(attribute.name, attribute.value)) unsafe()
    }
  })
  parser.on("closetag", () => { depth-- })
  parser.write(xml).close()
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

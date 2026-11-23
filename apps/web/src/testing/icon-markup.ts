import { iconWeights } from "@airdesign/document"
import { iconInk } from "@airdesign/pptx"
import { strokeWidth } from "@/editing/icon-redraw"

type IconNode = readonly [string, Readonly<Record<string, unknown>>, (readonly IconNode[])?]

function attributeText(value: unknown): string {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;")
}

function nodeXml([tag, attributes, children = []]: IconNode): string {
  const named = Object.entries(attributes)
    .filter(([name]) => name !== "key")
    .map(([name, value]) => ` ${name}="${attributeText(value)}"`)
    .join("")
  const inner = children.map(nodeXml).join("")
  return inner === "" ? `<${tag}${named}/>` : `<${tag}${named}>${inner}</${tag}>`
}

export function iconMarkup(
  nodes: readonly IconNode[],
  weight: number = iconWeights.lucide,
  hex: string = iconInk.hex,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#${hex}" stroke-width="${strokeWidth(weight)}" stroke-linecap="round" stroke-linejoin="round">${nodes.map(nodeXml).join("")}</svg>`
}

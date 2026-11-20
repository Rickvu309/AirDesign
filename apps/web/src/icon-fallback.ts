import { iconWeights } from "@airdesign/document"
import { iconInk, iconParts, unheldIcons, type IconRef } from "@airdesign/pptx"
import dynamicIconImports from "lucide-react/dynamicIconImports"
import { strokeWidth } from "@/icon-redraw"

type IconNode = readonly [string, Readonly<Record<string, unknown>>, (readonly IconNode[])?]

type IconModule = { readonly __iconData?: { readonly node: readonly IconNode[] } }

type Loaders = Readonly<Record<string, () => Promise<unknown>>>

const loaders: Loaders = dynamicIconImports

export const fallbackSide = 256

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

export async function iconSvg(
  name: string,
  weight: number = iconWeights.lucide,
  hex: string = iconInk.hex,
): Promise<string | null> {
  const load = Object.hasOwn(loaders, name) ? loaders[name] : undefined
  if (load === undefined) return null
  const data = ((await load()) as IconModule).__iconData
  return data === undefined ? null : iconMarkup(data.node, weight, hex)
}

const pngAddress = "data:image/png;base64,"

function dataBytes(address: string): Uint8Array {
  if (!address.startsWith(pngAddress)) throw new Error("icon-png")
  const encoded = atob(address.slice(pngAddress.length))
  return Uint8Array.from(encoded, (each) => each.charCodeAt(0))
}

export async function iconPng(svg: string, side = fallbackSide): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  try {
    const image = new Image(side, side)
    image.src = url
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = side
    canvas.height = side
    canvas.getContext("2d")?.drawImage(image, 0, 0, side, side)
    return dataBytes(canvas.toDataURL("image/png"))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function missingIcons(
  painted: ReadonlyMap<string, Uint8Array>,
  bytes: ReadonlyMap<string, Uint8Array>,
): readonly IconRef[] {
  return unheldIcons(painted).filter((icon) => {
    const named = iconParts(icon.name, icon.weight, icon.color)
    return !bytes.has(named.svg) || !bytes.has(named.png)
  })
}

export async function iconBytes(icon: IconRef): Promise<ReadonlyMap<string, Uint8Array> | null> {
  const svg = await iconSvg(icon.name, icon.weight, icon.color.hex)
  if (svg === null) return null
  const named = iconParts(icon.name, icon.weight, icon.color)
  return new Map([
    [named.svg, new TextEncoder().encode(svg)],
    [named.png, await iconPng(svg)],
  ])
}

import {
  assetIcon,
  floorNodes,
  landedPatch,
  openingElement,
  openingIcon,
  rowOf,
  type ElementPatch,
  type Register,
} from "@airdesign/document"
import { iconParts } from "@airdesign/pptx"
import dynamicIconImports from "lucide-react/dynamicIconImports"

type IconNode = readonly [string, Readonly<Record<string, unknown>>, (readonly IconNode[])?]

type IconModule = { readonly __iconData?: { readonly node: readonly IconNode[] } }

type Loaders = Readonly<Record<string, () => Promise<unknown>>>

const loaders: Loaders = dynamicIconImports

export const fallbackSide = 256

const ink = "000000"

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

export function iconMarkup(nodes: readonly IconNode[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${nodes.map(nodeXml).join("")}</svg>`
}

export async function iconSvg(name: string): Promise<string | null> {
  const load = Object.hasOwn(loaders, name) ? loaders[name] : undefined
  if (load === undefined) return null
  const data = ((await load()) as IconModule).__iconData
  return data === undefined ? null : iconMarkup(data.node)
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
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"))
    if (blob === null) throw new Error("icon-png")
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}

function patchIcons(patch: ElementPatch | undefined): readonly string[] {
  const source = patch?.image?.source
  const fill = patch?.fill?.value
  const refs = [
    typeof source === "object" ? source.set : null,
    typeof fill === "object" && "picture" in fill.set ? fill.set.picture : null,
  ]
  return refs.flatMap((ref) => (ref === null ? [] : (assetIcon(ref) ?? [])))
}

export function registerIcons(register: Register): readonly string[] {
  const names = new Set<string>()
  for (const command of register.order) {
    const icon = command.slide === "element-add" ? openingIcon(command.element) : null
    if (icon !== null) names.add(icon)
  }
  for (const node of floorNodes(register))
    for (const icon of patchIcons(openingElement(register, node)?.opening)) names.add(icon)
  for (const node of register.nodes) {
    const body = register.elements[node]
    if (body === undefined) continue
    for (const icon of patchIcons(landedPatch(body, "text"))) names.add(icon)
    for (const row of body.landed) for (const icon of patchIcons(rowOf(row, "text").patch)) names.add(icon)
  }
  return [...names]
}

export function missingIcons(register: Register, bytes: ReadonlyMap<string, Uint8Array>): readonly string[] {
  return registerIcons(register).filter((name) => {
    const named = iconParts(name)
    return !bytes.has(named.svg) || !bytes.has(named.png)
  })
}

export async function iconBytes(name: string): Promise<ReadonlyMap<string, Uint8Array> | null> {
  const svg = await iconSvg(name)
  if (svg === null) return null
  const named = iconParts(name)
  return new Map([
    [named.svg, new TextEncoder().encode(svg)],
    [named.png, await iconPng(svg)],
  ])
}

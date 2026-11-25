import { installedFaces } from "@airdesign/render"
import { type ReactElement } from "react"
import { createRoot } from "react-dom/client"

export class PictureFontError extends Error {}

export type PaintedPicture = { readonly image: HTMLImageElement; readonly width: number; readonly height: number }

function frames(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("painted-picture"))
    reader.readAsDataURL(blob)
  })
}

async function dataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error("Font file unavailable")
    return await blobDataUrl(await response.blob())
  } catch (cause) {
    throw new PictureFontError("Unable to embed slide font", { cause })
  }
}

async function shrunkUrl(url: string, longest: number): Promise<string> {
  const blob = await (await fetch(url)).blob()
  if (!blob.type.startsWith("image/") || blob.type === "image/svg+xml") return blobDataUrl(blob)
  const bitmap = await createImageBitmap(blob).catch(() => null)
  if (bitmap === null) return blobDataUrl(blob)
  const scale = longest / Math.max(bitmap.width, bitmap.height)
  if (scale >= 1) {
    bitmap.close()
    return blobDataUrl(blob)
  }
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(bitmap.width * scale)),
    Math.max(1, Math.round(bitmap.height * scale)),
  )
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return blobDataUrl(await canvas.convertToBlob({ type: "image/webp", quality: 0.9 }))
}

async function inlined(text: string, cache: Map<string, Promise<string>>, longest: number): Promise<string> {
  const found = [...text.matchAll(/blob:[^"')\s&]+/g)].map((match) => match[0])
  let next = text
  for (const url of new Set(found)) {
    let pending = cache.get(url)
    if (pending === undefined) {
      pending = shrunkUrl(url, longest)
      cache.set(url, pending)
    }
    next = next.replaceAll(url, await pending)
  }
  return next
}

type Face = ReturnType<typeof installedFaces>[number]

type UsedFaces = { readonly families: ReadonlySet<string>; readonly looks: ReadonlySet<string> }

const faceSources = new Map<string, Promise<string>>()

function familyName(name: string): string {
  return name.trim().replace(/^["']|["']$/g, "")
}

function lookOf(family: string, weight: string, style: string): string {
  return `${family}|${weight}|${style}`
}

export function usedFaces(root: Element, installed: ReadonlySet<string>): UsedFaces {
  const families = new Set<string>()
  const looks = new Set<string>()
  const view = root.ownerDocument.defaultView
  if (view === null) return { families, looks }
  const walker = root.ownerDocument.createTreeWalker(root, view.NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement
    if (parent === null || (node.textContent ?? "").trim() === "") continue
    const style = view.getComputedStyle(parent)
    for (const name of style.fontFamily.split(",")) {
      const family = familyName(name)
      if (!installed.has(family)) continue
      families.add(family)
      looks.add(lookOf(family, style.fontWeight, style.fontStyle))
    }
  }
  return { families, looks }
}

function weightIn(face: string, weight: number): boolean {
  const [low = Number.NaN, high = low] = face.split(/\s+/).map(Number)
  return weight >= low && weight <= high
}

function faceCovers(face: Face, look: string): boolean {
  const [family, weight, style] = look.split("|")
  return familyName(face.family) === family && face.style === style && weightIn(face.weight, Number(weight))
}

export function neededFaces(faces: readonly Face[], used: UsedFaces): readonly Face[] {
  const unique = [
    ...new Map(
      faces.map((face) => [`${familyName(face.family)}|${face.style}|${face.weight}|${face.url}`, face]),
    ).values(),
  ]
  const needed = new Set<Face>()
  for (const look of used.looks) {
    const family = look.split("|")[0]
    const exact = unique.filter((face) => faceCovers(face, look))
    const kin = unique.filter((face) => familyName(face.family) === family)
    for (const face of exact.length > 0 ? exact : kin) needed.add(face)
  }
  return [...needed]
}

async function fontRules(root: Element): Promise<string> {
  const faces = installedFaces(document)
  const used = usedFaces(root, new Set(faces.map((face) => familyName(face.family))))
  const rules = await Promise.all(
    neededFaces(faces, used).map(async (face) => {
      let pending = faceSources.get(face.url)
      if (pending === undefined) {
        pending = dataUrl(face.url).catch((error: unknown) => {
          faceSources.delete(face.url)
          throw error
        })
        faceSources.set(face.url, pending)
      }
      const source = await pending
      return `@font-face{font-family:${JSON.stringify(familyName(face.family))};font-style:${face.style};font-weight:${face.weight};src:url(${source})}`
    }),
  )
  return rules.join("")
}

const editableWrap = "\n[data-text-body]{overflow-wrap:break-word;line-break:after-white-space}"

function pageRules(): string {
  const rules: string[] = []
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) if (!(rule instanceof CSSFontFaceRule)) rules.push(rule.cssText)
    } catch {
      continue
    }
  }
  return rules.join("\n")
}

async function svgOf(root: Element, width: number, height: number, background: boolean): Promise<string> {
  const cache = new Map<string, Promise<string>>()
  const copy = root.cloneNode(true)
  if (copy instanceof HTMLElement && !background) copy.style.background = "transparent"
  const body = await inlined(new XMLSerializer().serializeToString(copy), cache, Math.max(width, height))
  const style = `<style><![CDATA[${((await fontRules(root)) + pageRules() + editableWrap).replaceAll("]]>", "")}]]></style>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px">${style}${body}</div></foreignObject></svg>`
}

async function drawn(svg: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  return image
}

const settledFrames = 120

async function settled(host: Element, ready: (host: Element) => boolean): Promise<void> {
  for (let waited = 0; waited < settledFrames && !ready(host); waited += 1) await frames()
}

export async function paintedElement(
  element: ReactElement,
  width: number,
  height: number,
  background: boolean,
  ready: (host: Element) => boolean = () => true,
): Promise<PaintedPicture> {
  const host = document.createElement("div")
  host.setAttribute("aria-hidden", "true")
  host.style.cssText = `position:fixed;left:${-width - 100}px;top:0;width:${width}px;height:${height}px;pointer-events:none`
  document.body.append(host)
  const root = createRoot(host)
  try {
    root.render(element)
    await frames()
    await settled(host, ready)
    await Promise.all([...host.querySelectorAll("img")].map((image) => image.decode().catch(() => undefined)))
    await frames()
    if (!ready(host)) throw new PictureFontError()
    const painted = host.firstElementChild
    if (painted === null) throw new Error("painted-picture")
    return { image: await drawn(await svgOf(painted, width, height, background)), width, height }
  } finally {
    root.unmount()
    host.remove()
  }
}

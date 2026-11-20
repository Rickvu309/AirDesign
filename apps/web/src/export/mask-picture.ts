import { readSlides, type MaskRun } from "@airdesign/pptx"
import {
  installedFaces,
  paintStore,
  SlideCanvas,
  waitForFonts,
  type CanvasElement,
  type CanvasSlide,
} from "@airdesign/render"
import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { paint } from "@/deck-paint"
import { busyElements } from "@/live-repaint"
import type { MaskPicture } from "@/export/mask-bake"

type Parts = ReadonlyMap<string, Uint8Array>

const inch = 914_400
const dots = 192
const longest = 4_096

function spanAt(elements: readonly CanvasElement[], at: number): number {
  return 1 + Math.min(elements[at]?.held ?? 0, elements.length - at - 1)
}

export function runElements(slide: CanvasSlide, part: string, run: MaskRun): readonly CanvasElement[] {
  const keys = new Set(run.run.map((id) => `${part}#${id}`))
  const start = slide.elements.findIndex((each) => each.key === `${part}#${run.mask}`)
  if (start < 0) throw new Error("mask-picture")
  let end = start
  while (end < slide.elements.length && keys.has(slide.elements[end]!.key)) end += spanAt(slide.elements, end)
  return slide.elements.slice(start, end)
}

function frames(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

async function dataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("mask-picture"))
    reader.readAsDataURL(blob)
  })
}

async function inlined(text: string, cache: Map<string, Promise<string>>): Promise<string> {
  const found = [...text.matchAll(/blob:[^"')\s&]+/g)].map((match) => match[0])
  let next = text
  for (const url of new Set(found)) {
    let pending = cache.get(url)
    if (pending === undefined) {
      pending = dataUrl(url)
      cache.set(url, pending)
    }
    next = next.replaceAll(url, await pending)
  }
  return next
}

async function fontRules(): Promise<string> {
  const rules = await Promise.all(
    installedFaces(document).map(async (face) => {
      const source = await dataUrl(face.url).catch(() => null)
      return source === null
        ? ""
        : `@font-face{font-family:${JSON.stringify(face.family)};font-style:${face.style};font-weight:${face.weight};src:url(${source})}`
    }),
  )
  return rules.join("")
}

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

async function svgOf(root: Element, width: number, height: number): Promise<string> {
  const cache = new Map<string, Promise<string>>()
  const copy = root.cloneNode(true)
  if (copy instanceof HTMLElement) copy.style.background = "transparent"
  const body = await inlined(new XMLSerializer().serializeToString(copy), cache)
  const style = `<style><![CDATA[${((await fontRules()) + pageRules()).replaceAll("]]>", "")}]]></style>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px">${style}${body}</div></foreignObject></svg>`
}

async function drawn(svg: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  return image
}

export function maskPicture(): MaskPicture {
  return async (parts: Parts, part: string, run: MaskRun) => {
    const store = paintStore()
    const painted = paint(store, parts, null, busyElements())
    const slide = painted.canvases(readSlides(parts).findIndex((each) => each.part === part))
    if (slide === null) throw new Error("mask-picture")
    const elements = runElements(slide, part, run)
    const mask = elements[0]?.box
    if (mask === undefined || mask === null) throw new Error("mask-picture")
    const fit = Math.min(1, longest / ((Math.max(mask.width, mask.height) / inch) * dots))
    const scale = (dots / inch) * fit
    const width = Math.ceil(slide.width * scale)
    const height = Math.ceil(slide.height * scale)
    const host = document.createElement("div")
    host.setAttribute("aria-hidden", "true")
    host.style.cssText = `position:fixed;left:${-width - 100}px;top:0;width:${width}px;height:${height}px;pointer-events:none`
    document.body.append(host)
    const root = createRoot(host)
    try {
      root.render(
        createElement(SlideCanvas, { store, slide: { ...slide, background: null, elements }, width, quiet: true }),
      )
      await frames()
      await waitForFonts(document)
      await Promise.all([...host.querySelectorAll("img")].map((image) => image.decode().catch(() => undefined)))
      await frames()
      const painted = host.firstElementChild
      if (painted === null) throw new Error("mask-picture")
      const image = await drawn(await svgOf(painted, width, height))
      const across = Math.max(1, Math.round(mask.width * scale))
      const down = Math.max(1, Math.round(mask.height * scale))
      const canvas = new OffscreenCanvas(across, down)
      const context = canvas.getContext("2d")
      if (context === null) throw new Error("mask-picture")
      context.translate(across / 2, down / 2)
      if (mask.flipH || mask.flipV) context.scale(mask.flipH ? -1 : 1, mask.flipV ? -1 : 1)
      context.rotate((-mask.rotation * Math.PI) / 180)
      context.translate(-(mask.x + mask.width / 2) * scale, -(mask.y + mask.height / 2) * scale)
      context.drawImage(image, 0, 0, width, height)
      const blob = await canvas.convertToBlob({ type: "image/png" })
      return new Uint8Array(await blob.arrayBuffer())
    } finally {
      root.unmount()
      host.remove()
    }
  }
}

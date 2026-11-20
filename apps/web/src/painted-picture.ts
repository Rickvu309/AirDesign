import {
  installedFaces,
  SlideCanvas,
  waitForFonts,
  type CanvasElement,
  type CanvasSlide,
  type PaintStore,
} from "@airdesign/render"
import { createElement } from "react"
import { createRoot } from "react-dom/client"

export type PaintedPicture = { readonly image: HTMLImageElement; readonly width: number; readonly height: number }

function frames(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

async function dataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("painted-picture"))
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

export async function paintedPicture(
  store: PaintStore,
  slide: CanvasSlide,
  elements: readonly CanvasElement[],
  scale: number,
): Promise<PaintedPicture> {
  const width = Math.ceil(slide.width * scale)
  const height = Math.ceil(slide.height * scale)
  const host = document.createElement("div")
  host.setAttribute("aria-hidden", "true")
  host.style.cssText = `position:fixed;left:${-width - 100}px;top:0;width:${width}px;height:${height}px;pointer-events:none`
  document.body.append(host)
  const root = createRoot(host)
  try {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide: { ...slide, background: null, elements },
        width,
        quiet: true,
      }),
    )
    await frames()
    await waitForFonts(document)
    await Promise.all([...host.querySelectorAll("img")].map((image) => image.decode().catch(() => undefined)))
    await frames()
    const painted = host.firstElementChild
    if (painted === null) throw new Error("painted-picture")
    return { image: await drawn(await svgOf(painted, width, height)), width, height }
  } finally {
    root.unmount()
    host.remove()
  }
}

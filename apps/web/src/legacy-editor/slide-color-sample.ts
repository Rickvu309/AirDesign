export type Rgba = { readonly r: number; readonly g: number; readonly b: number; readonly a: number }

const opaqueWhite: Rgba = { r: 255, g: 255, b: 255, a: 1 }
const opaqueBlack: Rgba = { r: 0, g: 0, b: 0, a: 1 }
const clear: Rgba = { r: 0, g: 0, b: 0, a: 0 }

const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const rgbPattern = /^rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i
const srgbPattern = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i
const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/i

const directionAngles: Readonly<Record<string, number>> = {
  "to top": 0,
  "to top right": 45,
  "to right top": 45,
  "to right": 90,
  "to bottom right": 135,
  "to right bottom": 135,
  "to bottom": 180,
  "to bottom left": 225,
  "to left bottom": 225,
  "to left": 270,
  "to top left": 315,
  "to left top": 315,
}

const imageCache = new Map<string, HTMLImageElement>()
let pixelCanvas: HTMLCanvasElement | null = null

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function channelValue(raw: string): number {
  if (raw.endsWith("%")) return clamp((Number.parseFloat(raw) / 100) * 255, 0, 255)
  return clamp(Number.parseFloat(raw), 0, 255)
}

function alphaValue(raw: string | undefined): number {
  if (raw === undefined) return 1
  if (raw.endsWith("%")) return clamp(Number.parseFloat(raw) / 100, 0, 1)
  return clamp(Number.parseFloat(raw), 0, 1)
}

export function parseCssColor(raw: string): Rgba | null {
  const text = raw.trim().toLowerCase()
  if (text === "" || text === "none") return null
  if (text === "transparent") return clear
  if (text === "white") return opaqueWhite
  if (text === "black") return opaqueBlack
  const hex = hexPattern.exec(text)?.[1]
  if (hex !== undefined) {
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt((hex[0] ?? "0").repeat(2), 16)
      const g = Number.parseInt((hex[1] ?? "0").repeat(2), 16)
      const b = Number.parseInt((hex[2] ?? "0").repeat(2), 16)
      const a = hex.length === 4 ? Number.parseInt((hex[3] ?? "f").repeat(2), 16) / 255 : 1
      return { r, g, b, a }
    }
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
    return { r, g, b, a }
  }
  const rgb = rgbPattern.exec(text)
  if (rgb !== null) {
    return {
      r: channelValue(rgb[1] ?? "0"),
      g: channelValue(rgb[2] ?? "0"),
      b: channelValue(rgb[3] ?? "0"),
      a: alphaValue(rgb[4]),
    }
  }
  const srgb = srgbPattern.exec(text)
  if (srgb !== null) {
    return {
      r: clamp(Number.parseFloat(srgb[1] ?? "0") * 255, 0, 255),
      g: clamp(Number.parseFloat(srgb[2] ?? "0") * 255, 0, 255),
      b: clamp(Number.parseFloat(srgb[3] ?? "0") * 255, 0, 255),
      a: alphaValue(srgb[4]),
    }
  }
  return null
}

export function compositeOver(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a)
  if (a <= 0) return clear
  return {
    r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
    g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
    b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
    a,
  }
}

export function rgbaToHex(color: Rgba): string {
  const solid = compositeOver(color, opaqueWhite)
  return [solid.r, solid.g, solid.b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
}

function splitTopLevel(text: string): readonly string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index]
    if (ch === "(") depth += 1
    else if (ch === ")") depth = Math.max(0, depth - 1)
    else if (ch === "," && depth === 0) {
      parts.push(text.slice(start, index).trim())
      start = index + 1
    }
  }
  const tail = text.slice(start).trim()
  if (tail !== "") parts.push(tail)
  return parts
}

function linearGradientBody(image: string): string | null {
  const start = image.toLowerCase().indexOf("linear-gradient(")
  if (start < 0) return null
  let depth = 0
  for (let index = start + "linear-gradient".length; index < image.length; index += 1) {
    const ch = image[index]
    if (ch === "(") depth += 1
    else if (ch === ")") {
      depth -= 1
      if (depth === 0) return image.slice(start + "linear-gradient(".length, index)
    }
  }
  return null
}

function gradientAngle(head: string): number | null {
  const trimmed = head.trim().toLowerCase()
  if (trimmed in directionAngles) return directionAngles[trimmed] ?? null
  const deg = /^(-?[\d.]+)deg$/.exec(trimmed)
  return deg === null ? null : Number.parseFloat(deg[1] ?? "180")
}

type Stop = { readonly color: Rgba; readonly at: number | null }

function parseStop(raw: string): Stop | null {
  const percent = /\s+(-?[\d.]+)%$/.exec(raw)
  const at = percent === null ? null : clamp(Number.parseFloat(percent[1] ?? "0") / 100, 0, 1)
  const colorText = percent === null ? raw : raw.slice(0, percent.index).trim()
  const color = parseCssColor(colorText)
  return color === null ? null : { color, at }
}

function interpolateStops(stops: readonly Stop[], t: number): Rgba | null {
  if (stops.length === 0) return null
  const positioned = stops.map((stop, index) => ({
    color: stop.color,
    at: stop.at ?? (stops.length === 1 ? 0 : index / (stops.length - 1)),
  }))
  const first = positioned[0]
  const last = positioned.at(-1)
  if (first === undefined || last === undefined) return null
  if (t <= first.at) return first.color
  if (t >= last.at) return last.color
  for (let index = 0; index < positioned.length - 1; index += 1) {
    const left = positioned[index]
    const right = positioned[index + 1]
    if (left === undefined || right === undefined || t > right.at) continue
    const span = right.at - left.at
    const ratio = span <= 0 ? 0 : (t - left.at) / span
    return {
      r: left.color.r + (right.color.r - left.color.r) * ratio,
      g: left.color.g + (right.color.g - left.color.g) * ratio,
      b: left.color.b + (right.color.b - left.color.b) * ratio,
      a: left.color.a + (right.color.a - left.color.a) * ratio,
    }
  }
  return last.color
}

function sampleLinearGradient(image: string, rect: DOMRect, x: number, y: number): Rgba | null {
  const body = linearGradientBody(image)
  if (body === null || rect.width <= 0 || rect.height <= 0) return null
  const parts = splitTopLevel(body)
  const head = parts[0]
  if (head === undefined) return null
  const angle = gradientAngle(head)
  const rawStops = angle === null ? parts : parts.slice(1)
  const stops = rawStops.flatMap((part) => {
    const parsed = parseStop(part)
    return parsed === null ? [] : [parsed]
  })
  const radians = ((angle ?? 180) * Math.PI) / 180
  const dx = Math.sin(radians)
  const dy = -Math.cos(radians)
  const half = (Math.abs(rect.width * dx) + Math.abs(rect.height * dy)) / 2
  if (half <= 0) return interpolateStops(stops, 0)
  const projected = (x - (rect.left + rect.width / 2)) * dx + (y - (rect.top + rect.height / 2)) * dy
  return interpolateStops(stops, clamp(0.5 + projected / (half * 2), 0, 1))
}

function sampleImageUrl(image: string, rect: DOMRect, x: number, y: number): Rgba | null {
  const url = urlPattern.exec(image)?.[1]
  if (url === undefined || rect.width <= 0 || rect.height <= 0 || typeof Image === "undefined") return null
  let loaded = imageCache.get(url)
  if (loaded === undefined) {
    loaded = new Image()
    loaded.crossOrigin = "anonymous"
    loaded.src = url
    imageCache.set(url, loaded)
  }
  if (!loaded.complete || loaded.naturalWidth <= 0 || loaded.naturalHeight <= 0) return null
  try {
    pixelCanvas ??= document.createElement("canvas")
    pixelCanvas.width = 1
    pixelCanvas.height = 1
    const context = pixelCanvas.getContext("2d", { willReadFrequently: true })
    if (context === null) return null
    const sx = clamp(Math.floor(((x - rect.left) / rect.width) * loaded.naturalWidth), 0, loaded.naturalWidth - 1)
    const sy = clamp(Math.floor(((y - rect.top) / rect.height) * loaded.naturalHeight), 0, loaded.naturalHeight - 1)
    context.clearRect(0, 0, 1, 1)
    context.drawImage(loaded, sx, sy, 1, 1, 0, 0, 1, 1)
    const data = context.getImageData(0, 0, 1, 1).data
    return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0, a: (data[3] ?? 0) / 255 }
  } catch {
    return null
  }
}

function containsPoint(rect: DOMRect, x: number, y: number): boolean {
  return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function insideEllipse(rect: DOMRect, x: number, y: number): boolean {
  const rx = rect.width / 2
  const ry = rect.height / 2
  if (rx <= 0 || ry <= 0) return false
  const nx = (x - (rect.left + rx)) / rx
  const ny = (y - (rect.top + ry)) / ry
  return nx * nx + ny * ny <= 1
}

function effectiveOpacity(node: Element, stopAt: Element): number {
  let opacity = 1
  let current: Element | null = node
  while (current !== null) {
    const style = getComputedStyle(current)
    if (style.display === "none" || style.visibility === "hidden") return 0
    const parsed = Number.parseFloat(style.opacity)
    if (!Number.isNaN(parsed)) opacity *= clamp(parsed, 0, 1)
    if (opacity <= 0 || current === stopAt) break
    current = current.parentElement
  }
  return opacity
}

function withOpacity(color: Rgba, opacity: number): Rgba {
  return { ...color, a: clamp(color.a * opacity, 0, 1) }
}

function sampleBackground(element: Element, rect: DOMRect, x: number, y: number, opacity: number): Rgba | null {
  const style = getComputedStyle(element)
  const image = style.backgroundImage
  if (image !== "" && image !== "none") {
    const fromImage = sampleLinearGradient(image, rect, x, y) ?? sampleImageUrl(image, rect, x, y)
    if (fromImage !== null && fromImage.a > 0) return withOpacity(fromImage, opacity)
  }
  const color = parseCssColor(style.backgroundColor)
  return color !== null && color.a > 0 ? withOpacity(color, opacity) : null
}

function sampleSvgGradient(svg: SVGSVGElement, paint: string, rect: DOMRect, x: number, y: number): Rgba | null {
  const id = /^url\(["']?#([^"')]+)["']?\)$/.exec(paint.trim())?.[1]
  if (id === undefined) return null
  const gradient = svg.querySelector(`[id="${CSS.escape(id)}"]`)
  if (gradient === null || gradient.tagName.toLowerCase() !== "lineargradient") return null
  const stops = [...gradient.querySelectorAll("stop")].flatMap((stop): Stop[] => {
    const colorText = stop.getAttribute("stop-color") ?? getComputedStyle(stop).stopColor
    const parsed = parseCssColor(colorText)
    if (parsed === null) return []
    const stopOpacity = Number.parseFloat(stop.getAttribute("stop-opacity") ?? "1")
    const offsetRaw = stop.getAttribute("offset") ?? ""
    const at = offsetRaw.endsWith("%")
      ? clamp(Number.parseFloat(offsetRaw) / 100, 0, 1)
      : offsetRaw === ""
        ? null
        : clamp(Number.parseFloat(offsetRaw), 0, 1)
    return [{ color: withOpacity(parsed, Number.isNaN(stopOpacity) ? 1 : stopOpacity), at }]
  })
  const x1 = Number.parseFloat(gradient.getAttribute("x1") ?? "0")
  const y1 = Number.parseFloat(gradient.getAttribute("y1") ?? "0")
  const x2 = Number.parseFloat(gradient.getAttribute("x2") ?? "100")
  const y2 = Number.parseFloat(gradient.getAttribute("y2") ?? "0")
  const vx = x2 - x1
  const vy = y2 - y1
  const lenSq = vx * vx + vy * vy
  if (lenSq <= 0 || rect.width <= 0 || rect.height <= 0) return interpolateStops(stops, 0)
  const px = ((x - rect.left) / rect.width) * 100 - x1
  const py = ((y - rect.top) / rect.height) * 100 - y1
  return interpolateStops(stops, clamp((px * vx + py * vy) / lenSq, 0, 1))
}

function hitSvgGeometry(svg: SVGSVGElement, node: Element, mode: "fill" | "stroke", x: number, y: number): boolean {
  const geometry = node as Partial<SVGGeometryElement>
  const check = mode === "fill" ? geometry.isPointInFill : geometry.isPointInStroke
  if (typeof check === "function" && typeof svg.createSVGPoint === "function") {
    const ctm = typeof svg.getScreenCTM === "function" ? svg.getScreenCTM() : null
    if (ctm !== null) {
      const point = svg.createSVGPoint()
      point.x = x
      point.y = y
      return check.call(node, point.matrixTransform(ctm.inverse()))
    }
  }
  const rect = node.getBoundingClientRect()
  if (containsPoint(rect, x, y)) return true
  return mode === "fill" && containsPoint(svg.getBoundingClientRect(), x, y)
}

function sampleSvg(svg: SVGSVGElement, x: number, y: number, opacity: number, into: Rgba[]): void {
  const shapes = [...svg.querySelectorAll("path, rect, ellipse, circle, polygon, line")].reverse()
  for (const shape of shapes) {
    if (shape.hasAttribute("data-canvas-grab") || shape.closest("defs, mask, clipPath, marker") !== null) continue
    const shapeOpacity = opacity * effectiveOpacity(shape, svg)
    if (shapeOpacity <= 0) continue
    const rect = shape.getBoundingClientRect()
    const box = rect.width > 0 && rect.height > 0 ? rect : svg.getBoundingClientRect()
    const strokeAttr = shape.getAttribute("stroke") ?? getComputedStyle(shape).stroke
    if (strokeAttr !== "" && strokeAttr !== "none" && strokeAttr !== "transparent") {
      if (hitSvgGeometry(svg, shape, "stroke", x, y)) {
        const strokeColor = parseCssColor(strokeAttr) ?? sampleSvgGradient(svg, strokeAttr, box, x, y)
        if (strokeColor !== null && strokeColor.a > 0) into.push(withOpacity(strokeColor, shapeOpacity))
      }
    }
    const fillAttr = shape.getAttribute("fill") ?? getComputedStyle(shape).fill
    if (fillAttr !== "" && fillAttr !== "none" && fillAttr !== "transparent") {
      if (hitSvgGeometry(svg, shape, "fill", x, y)) {
        const fillColor = parseCssColor(fillAttr) ?? sampleSvgGradient(svg, fillAttr, box, x, y)
        if (fillColor !== null && fillColor.a > 0) into.push(withOpacity(fillColor, shapeOpacity))
      }
    }
  }
}

function sampleTextSpans(element: Element, x: number, y: number, opacity: number, into: Rgba[]): void {
  const spans = [...element.querySelectorAll("[data-paragraph] span")].reverse()
  for (const span of spans) {
    if ((span.textContent ?? "").trim() === "") continue
    const rects =
      typeof span.getClientRects === "function" ? [...span.getClientRects()] : [span.getBoundingClientRect()]
    if (!rects.some((rect) => containsPoint(rect, x, y))) continue
    const color = parseCssColor(getComputedStyle(span).color)
    if (color !== null && color.a > 0) {
      into.push(withOpacity(color, opacity))
      return
    }
  }
}

function sampleElement(element: Element, slide: HTMLElement, x: number, y: number, into: Rgba[]): void {
  const opacity = effectiveOpacity(element, slide)
  if (opacity <= 0) return
  const rect = element.getBoundingClientRect()
  if (!containsPoint(rect, x, y)) return
  if (getComputedStyle(element).borderRadius === "50%" && !insideEllipse(rect, x, y)) return
  sampleTextSpans(element, x, y, opacity, into)
  for (const cell of [...element.querySelectorAll("td, th")].reverse()) {
    const cellRect = cell.getBoundingClientRect()
    if (!containsPoint(cellRect, x, y)) continue
    const sample = sampleBackground(cell, cellRect, x, y, opacity)
    if (sample !== null) into.push(sample)
  }
  for (const svg of [...element.querySelectorAll("svg[data-canvas-line]")].reverse()) {
    sampleSvg(svg as SVGSVGElement, x, y, opacity, into)
  }
  const layers = [...element.querySelectorAll(":scope > [data-fill-layer]")].reverse()
  if (layers.length > 0) {
    for (const layer of layers) {
      const overlay = layer.querySelector(":scope > [data-fill-overlay]")
      if (overlay !== null) {
        const sample = sampleBackground(overlay, overlay.getBoundingClientRect(), x, y, opacity)
        if (sample !== null) into.push(sample)
      }
      const paint = layer.querySelector(":scope > div:not([data-fill-overlay])")
      if (paint !== null) {
        const layerOpacity = opacity * effectiveOpacity(paint, layer)
        const sample = sampleBackground(paint, paint.getBoundingClientRect(), x, y, layerOpacity)
        if (sample !== null) into.push(sample)
      }
    }
    return
  }
  const own = sampleBackground(element, rect, x, y, opacity)
  if (own !== null) into.push(own)
}

export function sampleSlideColor(slide: HTMLElement, x: number, y: number): string | null {
  const slideRect = slide.getBoundingClientRect()
  if (!containsPoint(slideRect, x, y)) return null
  let acc: Rgba = clear
  const push = (samples: readonly Rgba[]) => {
    for (const sample of samples) {
      acc = compositeOver(acc, sample)
      if (acc.a >= 0.999) return true
    }
    return false
  }
  const elements = [...slide.querySelectorAll("[data-canvas-element]")].reverse()
  for (const element of elements) {
    const samples: Rgba[] = []
    sampleElement(element, slide, x, y, samples)
    if (push(samples)) return rgbaToHex(acc)
  }
  const background = sampleBackground(slide, slideRect, x, y, 1)
  if (background !== null) push([background])
  return rgbaToHex(acc)
}

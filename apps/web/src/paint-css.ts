import type { PaintColor, PaintElement, PaintFill } from "@airdesign/pptx"
import { unshownFill, type CanvasOutline } from "@airdesign/render"
import { pictureLayer, type PictureImage, type PictureSource } from "@/picture-fill"

import { diamondImage } from "@/diamond-gradient"

const quarterTurn = 90

export function visibleFill(fill: PaintFill | null): boolean {
  if (fill === null || fill.type === "none") return false
  if (fill.type === "solid") return fill.color.alpha > 0
  if (fill.type === "gradient") return fill.stops.some((stop) => stop.color.alpha > 0)
  if (fill.type === "pattern") return fill.foreground.alpha > 0 || fill.background.alpha > 0
  return true
}

export function cssColor(color: PaintColor): string {
  if (color.alpha >= 1) return `#${color.hex}`
  return `#${color.hex}${Math.round(color.alpha * 255)
    .toString(16)
    .padStart(2, "0")}`
}

export function cssGradient(fill: Extract<PaintFill, { type: "gradient" }>): string {
  const colors = fill.stops.map((stop) => ({ position: stop.position, color: cssColor(stop.color) }))
  if (fill.editor !== undefined && "diamond" in fill.editor) return diamondImage(fill.editor.diamond, colors)
  const stops = colors.map((stop) => `${stop.color} ${stop.position * 100}%`).join(", ")
  if (fill.editor !== undefined && "angular" in fill.editor) {
    const { angle, x, y } = fill.editor.angular
    return `conic-gradient(from ${angle / 60000}deg at ${x / 1000}% ${y / 1000}%, ${stops})`
  }
  return fill.angle === null ? `radial-gradient(${stops})` : `linear-gradient(${fill.angle + quarterTurn}deg, ${stops})`
}

function cssFill(fill: PaintFill | null): string | null {
  if (fill === null || fill.type === "none" || fill.type === "picture") return null
  if (fill.type === "solid") return cssColor(fill.color)
  return fill.type === "gradient" ? cssGradient(fill) : cssColor(fill.background)
}

function pictureCss(image: PictureImage, src: PictureSource, under: string | null = null): string {
  const url = src(image)
  const layer = url === null ? null : pictureLayer(image, url)
  if (layer === null) return unshownFill
  return under === null ? layer : `${layer}, ${under}`
}

export function fillOf(fill: PaintFill | null, src: PictureSource): string | null {
  return fill?.type === "picture" ? pictureCss(fill, src) : cssFill(fill)
}

export function pictureOver(row: PaintElement, src: PictureSource): string | null {
  if (row.image === null) return null
  return pictureCss(row.image, src, fillOf(row.fill, src))
}

export function paintedFill(row: PaintElement, outline: CanvasOutline, src: PictureSource): string | null {
  const over = pictureOver(row, src)
  if (over !== null) return over
  return outline === "line" ? null : fillOf(row.fill, src)
}

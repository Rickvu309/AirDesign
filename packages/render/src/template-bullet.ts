import type { ListSource } from "./paragraph-list.js"
import type { CanvasBullet, CanvasParagraph, CanvasText } from "./text-record.js"

export function templated(text: CanvasText, paragraph: CanvasParagraph): boolean {
  return text.templateBullets !== undefined && paragraph.ownBullet !== true
}

export function leveledBullet(text: CanvasText, paragraph: CanvasParagraph, level: number): CanvasBullet | null {
  return templated(text, paragraph) ? (text.templateBullets?.[level] ?? null) : (paragraph.bullet ?? null)
}

export function numberSource(text: CanvasText, paragraph: CanvasParagraph | undefined, kept?: number): ListSource {
  const level = paragraph?.level ?? 0
  if (paragraph === undefined) return { level, scheme: null }
  const leveled = kept !== undefined && templated(text, paragraph)
  const bullet = leveled ? leveledBullet(text, paragraph, kept) : paragraph.bullet
  if (bullet == null || !("autoNumber" in bullet)) return { level, scheme: null }
  const source = { level, scheme: bullet.autoNumber, start: bullet.start ?? bullet.number }
  return leveled ? { ...source, leveled: true } : source
}

import * as doom from "@airdesign/doom"
import {
  fontRevision,
  hanLanguage,
  loadFontLayout,
  pickServedFace,
  pinnedOpticalSize,
  servedLayout,
  weightRange,
  type LayoutFace,
  type LayoutRequest,
} from "@airdesign/fonts"
import type { FontSource } from "./font-source.js"

export async function bakeMeasure(
  fonts: Pick<FontSource, "family" | "file">,
  fold: doom.Doom,
  frame: doom.NodeId,
  stopped: () => boolean,
): Promise<doom.Measure | "fonts"> {
  const engine = await loadFontLayout()
  const { language } = doom.deckOf(fold)
  const locale = language === undefined || language === "und" ? hanLanguage(doom.deckTexts(fold)) : language
  const ready = new Map<string, LayoutFace | null>()
  const queued = new Map<string, LayoutRequest>()
  const pins = new Map<string, () => void>()
  let pending = false
  const measure = doom.measureWithLayout((input) => {
    const shaped = servedLayout(engine, input, input.locale ?? locale, (request) => {
      const key = JSON.stringify(request)
      const face = ready.get(key)
      if (face === undefined) queued.set(key, request)
      return face
    })
    if (shaped === undefined || shaped.pending) {
      pending = true
      return undefined
    }
    return {
      ...shaped,
      lines: shaped.lines.map((line) => ({ ...line.range, advance: line.advance, faces: [] })),
    }
  })
  try {
    while (!stopped()) {
      pending = false
      doom.bakeLayout(fold, frame, measure)
      if (!pending) return measure
      if (queued.size === 0) break
      const requests = [...queued]
      queued.clear()
      await Promise.all(
        requests.map(async ([key, { family, weight, italic }]) => {
          const manifest = await fonts.family(family)
          if (stopped()) return
          const file = manifest.ok ? pickServedFace(manifest.faces, weight, italic) : undefined
          if (file === undefined) {
            ready.set(key, null)
            return
          }
          if (!pins.has(file.url)) pins.set(file.url, engine.pinFace(fontRevision, file.url))
          const [low, high] = weightRange(file)
          const face = await engine.prepareFace({
            revision: fontRevision,
            key: file.url,
            axes: { wght: Math.min(high, Math.max(low, weight)), opsz: pinnedOpticalSize },
            read: async () => {
              const bytes = await fonts.file(family, file.file)
              if (bytes === undefined) throw new Error("Served face unavailable")
              return new Uint8Array(bytes)
            },
          })
          ready.set(key, face)
        }),
      )
    }
    return "fonts"
  } catch {
    return "fonts"
  } finally {
    for (const release of pins.values()) release()
  }
}

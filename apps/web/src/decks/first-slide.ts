import type { Register } from "@airdesign/document"
import { connect, getParts, memoryRemote } from "@airdesign/live"
import { paintStore, type CanvasSlide, type PaintStore } from "@airdesign/render"
import { paint } from "@/deck-paint"
import { busyElements } from "@/live-repaint"
import { pictureStore } from "@/picture-tool"
import type { PictureBytes } from "@/exported-parts"

export type FirstSlide = {
  readonly slide: CanvasSlide
  readonly store: PaintStore
  readonly display: ReadonlyMap<string, Uint8Array>
  release(): void
}

export function firstSlideOf(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register | null,
  pictureBytes?: PictureBytes,
): FirstSlide | null {
  const store = paintStore()
  const painted = paint(store, parts, register, busyElements(), pictureBytes)
  const slide = painted.canvases(0)
  if (slide === null) {
    painted.pictures.release()
    return null
  }
  return { slide, store, display: painted.display, release: () => painted.pictures.release() }
}

export async function deviceFirstSlide(deck: string): Promise<FirstSlide | null> {
  const stored = await getParts(deck)
  if (!stored.ok) return null
  const opened = await connect(memoryRemote()).openDeck(deck)
  const register = opened.ok ? opened.register : null
  const pictures = pictureStore()
  await pictures.load(deck, register).catch(() => false)
  const first = firstSlideOf(stored.parts, register, pictures.bytes)
  if (first === null || !(await pictures.load(deck, register, first.display).catch(() => false))) return first
  first.release()
  return firstSlideOf(stored.parts, register, pictures.bytes)
}

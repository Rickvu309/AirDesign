import { openRegister } from "@airdesign/document"
import { exportPackage, readParts, readSlides } from "@airdesign/pptx"
import { paintStore, type CanvasSlide, type PaintStore } from "@airdesign/render"
import editorialUrl from "@airdesign/templates/files/editorial.pptx?url"
import midnightUrl from "@airdesign/templates/files/midnight.pptx?url"
import neutralUrl from "@airdesign/templates/files/neutral.pptx?url"
import { paint } from "@/deck-paint"
import { chosenParts } from "@/export/chosen-parts"
import { busyElements } from "@/live-repaint"

export type DeckTemplate = { readonly id: string; readonly name: string }

export type TemplateSlides = {
  readonly slides: readonly CanvasSlide[]
  readonly store: PaintStore
  release(): void
}

const sampleDecks: Readonly<Record<string, string>> = {
  neutral: neutralUrl,
  midnight: midnightUrl,
  editorial: editorialUrl,
}

const pptxType = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

async function sampleBytes(id: string): Promise<Uint8Array> {
  const url = sampleDecks[id]
  if (url === undefined) throw new Error(id)
  return new Uint8Array(await (await fetch(url)).arrayBuffer())
}

export async function templateSlides(id: string): Promise<TemplateSlides> {
  const parts = await readParts(await sampleBytes(id))
  const store = paintStore()
  const painted = paint(store, parts, null, busyElements())
  const slides = readSlides(parts).flatMap((_, at) => {
    const slide = painted.canvases(at)
    return slide === null ? [] : [slide]
  })
  return { slides, store, release: () => painted.pictures.release() }
}

export async function templateDeck(template: DeckTemplate, slide?: number): Promise<File> {
  const bytes = await sampleBytes(template.id)
  const chosen =
    slide === undefined
      ? bytes
      : await exportPackage(bytes, chosenParts(await readParts(bytes), openRegister("", template.id), [slide]).parts)
  return new File([new Uint8Array(chosen)], `${template.name}.pptx`, { type: pptxType, lastModified: 0 })
}

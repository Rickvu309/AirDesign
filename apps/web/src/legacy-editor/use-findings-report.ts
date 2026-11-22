import {
  pictureType,
  readDeckId,
  type DeckId,
  type FindingsReport,
  type SlidePicture,
  type WireFinding,
} from "@airdesign/catalog"
import type { FontWidths, Register, ResolvedSlide, ResolvedText, SlideId } from "@airdesign/document"
import { openRuns } from "@airdesign/engine"
import { knownRevision, servedDeck, type Remote } from "@airdesign/live"
import { paintReader, readSlides, slideTextStyles } from "@airdesign/pptx"
import { useEffect } from "react"
import { server } from "@/commit-edit"
import { exportedParts } from "@/exported-parts"
import { measuredWidths } from "@/font-widths"
import { resolvedSlide, slideTexts, wireFindings } from "@/judged-slide"
import type { PictureStore } from "@/picture-tool"
import { slidePicture } from "@/slide-pictures"
import {
  relsOf,
  sameParts,
  slideKeyCache,
  slideKeys,
  templateOf,
  type KeyedSlide,
  type SlideKeys,
} from "./slide-picture-keys"

export const reportEvery = 500
export const quietFor = 1_000
export const idleWithin = 5_000
export const stillFor = 1_000

type Parts = ReadonlyMap<string, Uint8Array>

type JudgedSlide = {
  readonly slide: Uint8Array | undefined
  readonly rels: Uint8Array | undefined
  readonly resolved: ResolvedSlide | null
}

export type JudgedDeck = { template: readonly (Uint8Array | undefined)[]; slides: Map<string, JudgedSlide> }

export function judgedDeck(): JudgedDeck {
  return { template: [], slides: new Map() }
}

export function judgedOf(exported: Parts, kept: JudgedDeck): readonly ResolvedSlide[] {
  const template = templateOf(exported)
  if (!sameParts(template, kept.template)) {
    kept.template = template
    kept.slides = new Map()
  }
  const reader = paintReader(exported)
  const slides = readSlides(exported)
  const next = new Map<string, JudgedSlide>()
  for (const source of slides) {
    const slide = exported.get(source.part)
    const rels = exported.get(relsOf(source.part))
    const held = kept.slides.get(source.part)
    const resolved =
      held !== undefined && held.slide === slide && held.rels === rels
        ? held.resolved
        : resolvedSlide(source, reader, slideTextStyles(exported, source.part))
    next.set(source.part, { slide, rels, resolved })
  }
  kept.slides = next
  return [...next.values()].flatMap(({ resolved }) => (resolved === null ? [] : [resolved]))
}

type Report = { readonly findings: readonly WireFinding[]; readonly broken?: true }

const brokenReport: Report = { findings: [], broken: true }

async function reportFrom(
  exported: Parts,
  kept: JudgedDeck,
  measure: (texts: readonly ResolvedText[]) => Promise<FontWidths>,
): Promise<Report> {
  let slides: readonly ResolvedSlide[]
  try {
    slides = judgedOf(exported, kept)
  } catch {
    return brokenReport
  }
  const widths = await measure(slideTexts(slides))
  return { findings: slides.flatMap((slide) => wireFindings(slide, widths)) }
}

export async function reportOf(
  parts: Parts,
  register: Register,
  kept: JudgedDeck,
  measure: (texts: readonly ResolvedText[]) => Promise<FontWidths>,
): Promise<Report> {
  let exported: Parts
  try {
    exported = exportedParts(parts, register)
  } catch {
    return brokenReport
  }
  return reportFrom(exported, kept, measure)
}

export type PictureSource = { readonly store: PictureStore; readonly keys: SlideKeys }

export type PictureShots = {
  readonly report: Omit<FindingsReport, "pictures">
  readonly register: Register
  readonly keys: readonly KeyedSlide[]
  readonly missing: readonly SlideId[]
}

export type Reported = { readonly revision: number | undefined; readonly shots: PictureShots | null }

export function pictureSource(store: PictureStore): PictureSource {
  return { store, keys: slideKeyCache() }
}

async function wantedPictures(
  pictures: PictureSource | null,
  deck: DeckId,
  served: { readonly revision: number; readonly register: Register; readonly saved: Register },
): Promise<PictureSource | null> {
  if (pictures === null || openRuns(served.saved).length === 0) return null
  await pictures.store.load(deck, served.register).catch(() => false)
  return pictures
}

export async function sendFindings(
  deck: string,
  parts: Parts,
  reported: number | undefined,
  doc: Document,
  kept: JudgedDeck,
  pictures: PictureSource | null = null,
  remote: Remote = server,
): Promise<Reported> {
  const unchanged = { revision: reported, shots: null }
  const parsed = readDeckId(deck)
  if (!parsed.ok || remote.findings === undefined) return unchanged
  const served = await servedDeck(remote, deck)
  if (!served.ok || served.revision === reported) return unchanged
  const painting = await wantedPictures(pictures, parsed.deck, served)
  let exported: Parts | null = null
  try {
    exported = exportedParts(parts, served.register, painting?.store.bytes)
  } catch {
    exported = null
  }
  const measured =
    exported === null ? brokenReport : await reportFrom(exported, kept, (texts) => measuredWidths(doc, texts))
  const keys =
    painting === null || exported === null ? null : await slideKeys(exported, painting.keys).catch(() => null)
  const report = { deck: parsed.deck, revision: served.revision, ...measured }
  const sent = await remote.findings(keys === null ? report : { ...report, pictures: { keys, images: [] } })
  if (!sent.ok) return unchanged
  const shots = keys === null ? null : { report, register: served.register, keys, missing: sent.missing ?? [] }
  return { revision: served.revision, shots }
}

export async function sendPicture(
  shots: PictureShots,
  parts: Parts,
  store: PictureStore,
  remote: Remote = server,
): Promise<PictureShots | null> {
  const [slide] = shots.missing
  const key = shots.keys.find((each) => each.slide === slide)?.key
  if (slide === undefined || remote.findings === undefined) return shots
  const rest = { ...shots, missing: shots.missing.slice(1) }
  const data =
    key === undefined ? null : await slidePicture(parts, shots.register, store.bytes, slide).catch(() => null)
  if (key === undefined || data === null) return rest
  const image: SlidePicture = { slide, key, type: pictureType, data }
  const sent = await remote.findings({ ...shots.report, pictures: { keys: shots.keys, images: [image] } })
  if (!sent.ok) return null
  return { ...shots, missing: (sent.missing ?? []).filter((each) => each !== slide) }
}

function whenIdle(run: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: idleWithin })
  else setTimeout(run, 0)
}

type Touched = { (): number; stop(): void }

function stillSince(): Touched {
  let touched = 0
  const touch = () => {
    touched = Date.now()
  }
  const drag = (event: PointerEvent) => {
    if (event.buttons !== 0) touch()
  }
  window.addEventListener("keydown", touch, true)
  window.addEventListener("pointerdown", touch, true)
  window.addEventListener("pointermove", drag, true)
  return Object.assign(() => touched, {
    stop: () => {
      window.removeEventListener("keydown", touch, true)
      window.removeEventListener("pointerdown", touch, true)
      window.removeEventListener("pointermove", drag, true)
    },
  })
}

export function useFindingsReport(
  deck: string,
  parts: { readonly current: Parts },
  opened: boolean,
  store: PictureStore,
): void {
  useEffect(() => {
    if (!opened) return
    let live = true
    let running = false
    let reported: number | undefined
    let shots: PictureShots | null = null
    let seen: number | undefined
    let changed = Date.now()
    const kept = judgedDeck()
    const pictures = pictureSource(store)
    const touched = stillSince()
    const report = () => {
      void sendFindings(deck, parts.current, reported, document, kept, pictures)
        .then((next) => {
          if (!live) return
          reported = next.revision
          shots = next.shots
        })
        .catch(() => undefined)
        .finally(() => {
          running = false
          changed = Date.now()
        })
    }
    const picture = (held: PictureShots) => {
      if (Date.now() - touched() < stillFor) {
        running = false
        return
      }
      void sendPicture(held, parts.current, store)
        .then((next) => {
          if (live && shots === held) shots = next
        })
        .catch(() => undefined)
        .finally(() => {
          running = false
        })
    }
    const tick = () => {
      const known = knownRevision(server, deck)
      if (known !== seen) {
        seen = known
        changed = Date.now()
      }
      if (running || known === undefined || Date.now() - changed < quietFor) return
      if (known !== reported) {
        running = true
        whenIdle(report)
        return
      }
      const held = shots
      if (held === null || held.report.revision !== known || held.missing.length === 0) return
      if (Date.now() - touched() < stillFor) return
      running = true
      whenIdle(() => picture(held))
    }
    const timer = setInterval(tick, reportEvery)
    return () => {
      live = false
      clearInterval(timer)
      touched.stop()
    }
  }, [deck, parts, opened, store])
}

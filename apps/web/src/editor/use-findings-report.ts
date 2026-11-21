import { readDeckId } from "@airdesign/catalog"
import { knownRevision, servedDeck, type Remote } from "@airdesign/live"
import { paintReader, readSlides } from "@airdesign/pptx"
import { useEffect } from "react"
import { server } from "@/commit-edit"
import { exportedParts } from "@/exported-parts"
import { measuredWidths } from "@/font-widths"
import { resolvedSlide, slideTexts, wireFindings } from "@/judged-slide"
import type { FontWidths, Register, ResolvedSlide, ResolvedText } from "@airdesign/document"
import type { WireFinding } from "@airdesign/catalog"

export const reportEvery = 500
export const quietFor = 1_000
export const idleWithin = 5_000

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

const templatePart = /^ppt\/(slideLayouts|slideMasters|theme)\/[^/]+\.xml$/

function relsOf(part: string): string {
  const at = part.lastIndexOf("/")
  return `${part.slice(0, at)}/_rels/${part.slice(at + 1)}.rels`
}

function sameParts(left: readonly (Uint8Array | undefined)[], right: readonly (Uint8Array | undefined)[]): boolean {
  return left.length === right.length && left.every((bytes, at) => bytes === right[at])
}

export function judgedOf(exported: Parts, kept: JudgedDeck): readonly ResolvedSlide[] {
  const template = [...exported.keys()]
    .filter((name) => templatePart.test(name))
    .sort()
    .map((name) => exported.get(name))
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
      held !== undefined && held.slide === slide && held.rels === rels ? held.resolved : resolvedSlide(source, reader)
    next.set(source.part, { slide, rels, resolved })
  }
  kept.slides = next
  return [...next.values()].flatMap(({ resolved }) => (resolved === null ? [] : [resolved]))
}

type Report = { readonly findings: readonly WireFinding[]; readonly broken?: true }

export async function reportOf(
  parts: Parts,
  register: Register,
  kept: JudgedDeck,
  measure: (texts: readonly ResolvedText[]) => Promise<FontWidths>,
): Promise<Report> {
  let slides: readonly ResolvedSlide[]
  try {
    slides = judgedOf(exportedParts(parts, register), kept)
  } catch {
    return { findings: [], broken: true }
  }
  const widths = await measure(slideTexts(slides))
  return { findings: slides.flatMap((slide) => wireFindings(slide, widths)) }
}

export async function sendFindings(
  deck: string,
  parts: Parts,
  reported: number | undefined,
  doc: Document,
  kept: JudgedDeck,
  remote: Remote = server,
): Promise<number | undefined> {
  const parsed = readDeckId(deck)
  if (!parsed.ok || remote.findings === undefined) return reported
  const served = await servedDeck(remote, deck)
  if (!served.ok || served.revision === reported) return reported
  const report = await reportOf(parts, served.register, kept, (texts) => measuredWidths(doc, texts))
  const sent = await remote.findings({ deck: parsed.deck, revision: served.revision, ...report })
  return sent.ok ? served.revision : reported
}

function whenIdle(run: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: idleWithin })
  else setTimeout(run, 0)
}

export function useFindingsReport(deck: string, parts: { readonly current: Parts }, opened: boolean): void {
  useEffect(() => {
    if (!opened) return
    let live = true
    let running = false
    let reported: number | undefined
    let seen: number | undefined
    let changed = Date.now()
    const kept = judgedDeck()
    const tick = () => {
      const known = knownRevision(server, deck)
      if (known !== seen) {
        seen = known
        changed = Date.now()
      }
      if (running || known === undefined || known === reported || Date.now() - changed < quietFor) return
      running = true
      whenIdle(() => {
        void sendFindings(deck, parts.current, reported, document, kept)
          .then((next) => {
            if (live) reported = next
          })
          .catch(() => undefined)
          .finally(() => {
            running = false
            changed = Date.now()
          })
      })
    }
    const timer = setInterval(tick, reportEvery)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [deck, parts, opened])
}

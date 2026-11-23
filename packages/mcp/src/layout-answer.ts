import * as doom from "@airdesign/doom"

import type { DeckHost } from "./deck-host.js"

export type Finding = doom.AgentFinding | doom.LayoutFinding
export type Layout = "measured" | "unmeasured" | "untouched"
export type Findings = { readonly findings: readonly Finding[]; readonly layout: Layout }
export type Laid = Findings & { readonly boxes?: ReadonlyMap<doom.NodeId, doom.Box> }

const layoutCodes: ReadonlySet<string> = new Set(["overflow", "overlap", "off-slide", "small-text"])

const words = {
  edit: "The edit landed. Each finding names what is off on a slide or off the deck's own choices, and the fix: fix it unless the person asked for it.",
  read: "Each finding names what is off on the slides read, and the fix: fix it unless the person asked for it.",
  clear:
    "Laid out with the deck's own fonts, no words overflow or overlap, nothing runs off a slide and no text is too small to read.",
  unmeasured: "The layout went unchecked: the deck's fonts could not be read, so overflow and overlap are unknown.",
} as const

function layoutWords(findings: Findings): readonly string[] {
  if (findings.layout === "unmeasured") return [words.unmeasured]
  if (findings.layout === "untouched") return []
  return findings.findings.some((found) => layoutCodes.has(found.code)) ? [] : [words.clear]
}

export function findingsNote(findings: Findings): readonly string[] {
  return [...(findings.findings.length === 0 ? [] : [words.edit]), ...layoutWords(findings)]
}

export function readFindingsNote(laid: Findings): readonly string[] {
  return [...(laid.findings.length === 0 ? [] : [words.read]), ...layoutWords(laid)]
}

export async function layoutOf(host: DeckHost, fold: doom.Doom, slides: readonly doom.NodeId[]): Promise<Laid> {
  if (host.measure === undefined || slides.length === 0) return { findings: [], layout: "untouched" }
  const measure = await host.measure(fold)
  if (measure === undefined) return { findings: [], layout: "unmeasured" }
  const boxes = new Map(slides.flatMap((slide) => [...doom.solveLayout(fold, slide, measure)]))
  return { findings: doom.layoutFindings(fold, slides, measure), layout: "measured", boxes }
}

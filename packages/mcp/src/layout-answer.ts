import * as doom from "@airdesign/doom"

import type { DeckHost, Unmeasured } from "./deck-host.js"

export type Finding = doom.AgentFinding | doom.LayoutFinding
export type Layout = "measured" | "untouched" | "fault" | Unmeasured
export type Findings = { readonly findings: readonly Finding[]; readonly layout: Layout }
export type Laid = Findings & { readonly boxes?: ReadonlyMap<doom.NodeId, doom.Box> }

const shownFindings = 10
const layoutCodes: ReadonlySet<string> = new Set(["overflow", "overlap", "off-slide", "small-text"])

const words = {
  edit: "The edit landed. Each finding names what is off on a slide or off the deck's own choices, and the fix: fix it unless the person asked for it.",
  read: "Each finding names what is off on the slides read, and the fix: fix it unless the person asked for it.",
  clear: "Layout clear: no overflow, overlap, off-slide or small text.",
  more: (count: number, where: string) => `${String(count)} more findings are not listed: ${where}.`,
  unchecked: {
    fonts: "the deck's fonts could not be read",
    glyphs: "its fonts have no letters for some of its characters, so those words would paint in another font",
    time: "the fonts took too long to load; read the deck again in a moment",
    fault: "it could not be worked out",
  },
} as const

const unchecked = (layout: Exclude<Layout, "measured" | "untouched">) =>
  `The layout went unchecked: ${words.unchecked[layout]}. Overflow and overlap are unknown.`

function layoutWords(findings: Findings): readonly string[] {
  if (findings.layout === "untouched") return []
  if (findings.layout !== "measured") return [unchecked(findings.layout)]
  return findings.findings.some((found) => layoutCodes.has(found.code)) ? [] : [words.clear]
}

function shown(findings: Findings, lead: string, where: string): readonly string[] {
  const hidden = findings.findings.length - shownFindings
  return [
    ...(findings.findings.length === 0 ? [] : [lead]),
    ...(hidden > 0 ? [words.more(hidden, where)] : []),
    ...layoutWords(findings),
  ]
}

export const findingsNote = (findings: Findings) => shown(findings, words.edit, "read the slides this edit touched")
export const readFindingsNote = (laid: Findings) => shown(laid, words.read, "read one slide at a time")

export function listed(
  findings: readonly Finding[],
): readonly Finding[] | readonly Pick<Finding, "code" | "node" | "note">[] {
  return findings
    .slice(0, shownFindings)
    .map((found) => (layoutCodes.has(found.code) ? { code: found.code, node: found.node, note: found.note } : found))
}

export async function layoutOf(host: DeckHost, fold: doom.Doom, slides: readonly doom.NodeId[]): Promise<Laid> {
  if (host.measure === undefined || slides.length === 0) return { findings: [], layout: "untouched" }
  try {
    const measured = await host.measure(fold)
    if (typeof measured === "string") return { findings: [], layout: measured }
    const boxes = new Map(slides.flatMap((slide) => [...doom.solveLayout(fold, slide, measured)]))
    return { findings: doom.layoutFindings(fold, slides, measured), layout: "measured", boxes }
  } catch {
    return { findings: [], layout: "fault" }
  }
}

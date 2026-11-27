import * as doom from "@airdesign/doom"

import { namedIds, shownProblems } from "./budget.js"
import type { DeckHost, Unmeasured } from "./deck-host.js"
import { type Problem, worded } from "./problem-words.js"

export type Layout = "measured" | "untouched" | "fault" | Unmeasured
export type Problems = {
  readonly problems: readonly Problem[]
  readonly layout: Layout
  readonly unread?: readonly doom.NodeId[]
}
export type Laid = Problems & { readonly boxes?: ReadonlyMap<doom.NodeId, doom.Box> }

const layoutCodes: ReadonlySet<string> = new Set([
  "overflow",
  "overlap",
  "off-slide",
  "small-text",
  "lone-word",
  "line-crosses-text",
])

function namesOf(nodes: readonly doom.NodeId[]): string {
  const shown = nodes.slice(0, namedIds)
  const more = nodes.length - shown.length
  const heads = more > 0 ? shown : shown.slice(0, -1)
  const tail = more > 0 ? `${String(more)} more` : shown.at(-1)!
  return heads.length === 0 ? tail : `${heads.join(", ")} and ${tail}`
}

const words = {
  edit: "Each problem names what is off on a slide or off the deck's own choices, and the fix: fix it unless the person asked for it.",
  read: "Each problem names what is off on the slides read, and the fix: fix it unless the person asked for it.",
  clear: "Layout clear: no overflow, overlap, line crossings, off-slide or small text.",
  more: (count: number, where: string) => `${String(count)} more are not listed: ${where}.`,
  unread: (nodes: readonly doom.NodeId[]) => {
    const one = nodes.length === 1
    return `${namesOf(nodes)} ${one ? "has a character" : "have characters"} the deck's fonts lack, so ${one ? "its" : "their"} overflow and overlap are unknown. Check ${one ? "it" : "them"} by eye, or change the font or the ${one ? "character" : "characters"}.`
  },
  unchecked: {
    fonts: "the deck's fonts could not be read",
    time: "the fonts took too long to load; read the deck again in a moment",
    fault: "it could not be worked out",
  },
} as const

const unchecked = (layout: Exclude<Layout, "measured" | "untouched">) =>
  `The layout went unchecked: ${words.unchecked[layout]}. Overflow and overlap are unknown.`

function layoutWords(problems: Problems): readonly string[] {
  if (problems.layout === "untouched") return []
  if (problems.layout !== "measured") return [unchecked(problems.layout)]
  const unread = problems.unread ?? []
  if (unread.length > 0) return [words.unread(unread)]
  return problems.problems.some((found) => layoutCodes.has(found.code)) ? [] : [words.clear]
}

function shown(problems: Problems, lead: string, where: string): readonly string[] {
  const hidden = problems.problems.length - shownProblems
  return [
    ...(problems.problems.length === 0 ? [] : [lead]),
    ...(hidden > 0 ? [words.more(hidden, where)] : []),
    ...layoutWords(problems),
  ]
}

export const problemsNote = (problems: Problems) => shown(problems, words.edit, "get each slide this call touched")
export const readProblemsNote = (laid: Problems) => shown(laid, words.read, "get one slide at a time")

export function listed(
  problems: readonly Problem[],
): readonly Problem[] | readonly Pick<Problem, "code" | "node" | "note">[] {
  return problems
    .slice(0, shownProblems)
    .map((found) => (layoutCodes.has(found.code) ? { code: found.code, node: found.node, note: found.note } : found))
}

export async function layoutOf(host: DeckHost, fold: doom.Doom, touched: () => readonly doom.NodeId[]): Promise<Laid> {
  try {
    const slides = touched()
    if (slides.length === 0 || host.measure === undefined) return { problems: [], layout: "untouched" }
    const measured = await host.measure([fold])
    if (typeof measured === "string") return { problems: [], layout: measured }
    const { measure, missing } = measured
    const boxes = new Map(slides.flatMap((slide) => [...doom.solveLayout(fold, slide, measure)]))
    const unread = doom.unmeasuredTexts(fold, slides, missing)
    return {
      problems: worded(fold, doom.layoutProblems(fold, slides, measure, missing)),
      layout: "measured",
      boxes,
      unread,
    }
  } catch {
    return { problems: [], layout: "fault" }
  }
}

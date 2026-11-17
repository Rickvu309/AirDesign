import type { ElementId, SlideId } from "@airdesign/document"
import { adjustToneCopy } from "@/copy/adjust-tone-copy"

export type ToneScope = {
  readonly slide: SlideId
  readonly selection: readonly ElementId[]
  readonly text: readonly ElementId[]
}

type DialStep = 0 | 1 | 2
export type TonePoint = { readonly column: DialStep; readonly row: DialStep }
export type Tone = (typeof adjustToneCopy.presets)[number] | TonePoint

export const toneCenter: TonePoint = { column: 1, row: 1 }
export const dialSteps = [0, 1, 2] as const

export function dialStep(value: number): DialStep {
  return value < 0.5 ? 0 : value < 1.5 ? 1 : 2
}

export function toneName(tone: Tone): string {
  if (typeof tone === "string") return tone
  const width = [adjustToneCopy.concise, "", adjustToneCopy.expanded][tone.column]
  const voice = [adjustToneCopy.professional, "", adjustToneCopy.casual][tone.row]
  return [voice, width].filter(Boolean).join(", ") || adjustToneCopy.balanced
}

function toneTarget({ slide, selection }: ToneScope): string {
  return selection.length === 0 ? `slide ${slide}` : `selection ${[...selection].sort().join(", ")}`
}

export function tonePrompt(scope: ToneScope, tone: Tone): string {
  const text =
    scope.selection.length === 0
      ? `all editable text elements on slide ${scope.slide}`
      : `only these editable text elements: ${scope.text.join(", ")}`
  return [
    `Adjust tone for ${toneTarget(scope)}. Tone: ${toneName(tone)}.`,
    `Read slide ${scope.slide} using the deck tools. Rewrite ${text} in place, using this tone.`,
    "Preserve the language, meaning, facts, paragraph structure, links, and existing formatting.",
    "Change only the text of those elements. Leave empty placeholders, notes, and other elements alone.",
    "Use one batched edit in the deck tools for the changes. If you already rewrote this text in the conversation, use different wording.",
  ].join("\n")
}

export function requestedTone(scope: ToneScope, prompt: string): Tone | undefined {
  const lead = `Adjust tone for ${toneTarget(scope)}. Tone: `
  if (!prompt.startsWith(lead)) return undefined
  const name = prompt.slice(lead.length).split(".\n", 1)[0]
  const choices: readonly Tone[] = [
    ...adjustToneCopy.presets,
    ...dialSteps.flatMap((row) => dialSteps.map((column) => ({ column, row }))),
  ]
  return choices.find((tone) => toneName(tone) === name)
}

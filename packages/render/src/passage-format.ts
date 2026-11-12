import {
  formatRange,
  formatState,
  formatWhole,
  writeTextValue,
  type Caret,
  type ElementId,
  type TextFormat,
  type TextRange,
  type TextValue,
} from "@airdesign/document"
import type { TextFormatting } from "./text-formatting.js"
import type { TextLook } from "./text-look.js"

export type FormatEdit = {
  readonly look: TextLook | undefined
  readonly read: (shown: HTMLElement) => { readonly value: TextValue; readonly carets: TextRange | null }
  readonly edit: (shown: HTMLElement, value: TextValue, start: Caret, end: Caret) => void
}

const firstCaret: Caret = { paragraph: 0, offset: 0 }

function collapsed(range: TextRange): boolean {
  return range.start.paragraph === range.end.paragraph && range.start.offset === range.end.offset
}

export function formatTarget(
  formatting: TextFormatting,
  id: ElementId,
  shown: HTMLElement,
  formats: { readonly current: FormatEdit | null },
): () => void {
  let kept: TextRange | null = null
  const keep = () => {
    const carets = formats.current?.read(shown).carets ?? null
    if (carets !== null) kept = carets
  }
  const range = (editing: boolean) => (!editing || kept === null || collapsed(kept) ? null : kept)
  const file = (paragraph: number, run: number, format: TextFormat) =>
    formats.current?.look?.file(paragraph, run, format) ?? false
  const unregister = formatting.register(id, {
    edits: (node) => node === shown,
    state(format, editing) {
      const current = formats.current
      return current === null ? "off" : formatState(current.read(shown).value, range(editing), format, file)
    },
    apply(format, editing) {
      const current = formats.current
      if (current === null) return
      const value = current.read(shown).value
      const chosen = range(editing)
      const on = formatState(value, chosen, format, file) !== "on"
      const next = chosen === null ? formatWhole(value, format, on, file) : formatRange(value, chosen, format, on, file)
      if (writeTextValue(next) === writeTextValue(value)) return
      const at = chosen ?? kept ?? { start: firstCaret, end: firstCaret }
      current.edit(shown, next, at.start, at.end)
    },
  })
  const document = shown.ownerDocument
  document.addEventListener("selectionchange", keep)
  return () => {
    document.removeEventListener("selectionchange", keep)
    unregister()
  }
}

import {
  alignRange,
  alignState,
  bulletRange,
  bulletState,
  colorRange,
  colorState,
  formatRange,
  formatState,
  formatWhole,
  sizeState,
  stepSize,
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
  const look = (): TextLook | undefined => formats.current?.look
  const file = (paragraph: number, run: number, format: TextFormat) => look()?.file(paragraph, run, format) ?? false
  const fileSize = (paragraph: number, run: number) => look()?.fileSize(paragraph, run) ?? null
  const fileColor = (paragraph: number, run: number) => look()?.fileColor(paragraph, run) ?? null
  const fileAlign = (paragraph: number) => look()?.fileAlign(paragraph) ?? null
  const fileBullet = (paragraph: number) => look()?.fileBullet(paragraph) ?? false
  const readNow = () => {
    const current = formats.current
    return current === null ? null : { current, value: current.read(shown).value }
  }
  const commit = (value: TextValue, next: TextValue, editing: boolean) => {
    const current = formats.current
    if (current === null || writeTextValue(next) === writeTextValue(value)) return
    const chosen = range(editing)
    const at = chosen ?? kept ?? { start: firstCaret, end: firstCaret }
    current.edit(shown, next, at.start, at.end)
  }
  const unregister = formatting.register(id, {
    edits: (node) => node === shown,
    state(format, editing) {
      const read = readNow()
      return read === null ? "off" : formatState(read.value, range(editing), format, file)
    },
    apply(format, editing) {
      const read = readNow()
      if (read === null) return
      const chosen = range(editing)
      const on = formatState(read.value, chosen, format, file) !== "on"
      const next =
        chosen === null ? formatWhole(read.value, format, on, file) : formatRange(read.value, chosen, format, on, file)
      commit(read.value, next, editing)
    },
    size(editing) {
      const read = readNow()
      return read === null ? null : sizeState(read.value, range(editing), fileSize)
    },
    resize(delta, editing) {
      const read = readNow()
      if (read === null) return
      commit(read.value, stepSize(read.value, range(editing), delta * 100, fileSize), editing)
    },
    color(editing) {
      const read = readNow()
      return read === null ? null : colorState(read.value, range(editing), fileColor)
    },
    choose(color, editing) {
      const read = readNow()
      if (read === null) return
      commit(read.value, colorRange(read.value, range(editing), color, fileColor), editing)
    },
    align(editing) {
      const read = readNow()
      return read === null ? null : alignState(read.value, range(editing), fileAlign)
    },
    place(align, editing) {
      const read = readNow()
      if (read === null) return
      commit(read.value, alignRange(read.value, range(editing), align, fileAlign), editing)
    },
    bullet(editing) {
      const read = readNow()
      return read === null ? "off" : bulletState(read.value, range(editing), fileBullet)
    },
    bullets(editing) {
      const read = readNow()
      if (read === null) return
      const on = bulletState(read.value, range(editing), fileBullet) !== "on"
      commit(read.value, bulletRange(read.value, range(editing), on, fileBullet), editing)
    },
    swatches: () => look()?.swatches() ?? [],
  })
  const document = shown.ownerDocument
  document.addEventListener("selectionchange", keep)
  return () => {
    document.removeEventListener("selectionchange", keep)
    unregister()
  }
}

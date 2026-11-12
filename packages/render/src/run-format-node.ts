import { formatNames, type RunFormat } from "@airdesign/document"

export function writeFormat(span: HTMLElement, format: RunFormat): void {
  for (const name of formatNames) {
    const set = format[name]
    if (set !== undefined) span.dataset[name] = String(set)
  }
}

export function readFormat(span: HTMLElement): RunFormat {
  let format: RunFormat = {}
  for (const name of formatNames) {
    const set = span.dataset[name]
    if (set === "true" || set === "false") format = { ...format, [name]: set === "true" }
  }
  return format
}

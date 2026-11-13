import { formatNames, schemeNames, type RunColor, type RunFormat, type SchemeName } from "@airdesign/document"

type RunPaint = RunFormat & { readonly size?: number; readonly color?: RunColor }

const sizeFloor = 100
const sizeCeiling = 400_000

function schemeOf(value: string): SchemeName | null {
  return schemeNames.find((name) => name === value) ?? null
}

function readSize(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null
  const size = Number(value)
  return size >= sizeFloor && size <= sizeCeiling ? size : null
}

function readColor(value: string | undefined): RunColor | null {
  if (value === undefined) return null
  if (value.startsWith("scheme:")) {
    const scheme = schemeOf(value.slice("scheme:".length))
    return scheme === null ? null : { scheme }
  }
  if (value.startsWith("rgb:")) {
    const rgb = value.slice("rgb:".length)
    return /^[0-9A-F]{6}$/.test(rgb) ? { rgb } : null
  }
  return null
}

export function writeFormat(span: HTMLElement, format: RunPaint): void {
  for (const name of formatNames) {
    const set = format[name]
    if (set !== undefined) span.dataset[name] = String(set)
  }
  if (format.size !== undefined) span.dataset.size = String(format.size)
  if (format.color !== undefined) {
    span.dataset.color = "scheme" in format.color ? `scheme:${format.color.scheme}` : `rgb:${format.color.rgb}`
  }
}

export function readFormat(span: HTMLElement): RunPaint {
  let format: RunPaint = {}
  for (const name of formatNames) {
    const set = span.dataset[name]
    if (set === "true" || set === "false") format = { ...format, [name]: set === "true" }
  }
  const size = readSize(span.dataset.size)
  if (size !== null) format = { ...format, size }
  const color = readColor(span.dataset.color)
  if (color !== null) format = { ...format, color }
  return format
}

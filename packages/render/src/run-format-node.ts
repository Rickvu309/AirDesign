import {
  readElementLink,
  type ElementLink,
  readTextFill,
  type TextFill,
  formatNames,
  readColor,
  type Color,
  type ColorTransform,
  type RunFormat,
  caseNames,
  type TextCase,
} from "@airdesign/document"

type RunPaint = RunFormat & {
  readonly link?: ElementLink
  readonly size?: number
  readonly fill?: TextFill
  readonly color?: Color
  readonly font?: string
  readonly letterSpacing?: number
  readonly case?: TextCase
}

const sizeFloor = 100
const sizeCeiling = 400_000

function readSize(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null
  const size = Number(value)
  return size >= sizeFloor && size <= sizeCeiling ? size : null
}

const integer = /^-?\d+$/

function baseToken(color: Color): string {
  if ("scheme" in color) return `scheme:${color.scheme}`
  if ("rgb" in color) return `rgb:${color.rgb}`
  if ("system" in color) return `system:${color.system}:${color.last}`
  return `preset:${color.preset}`
}

function transformToken(transform: ColorTransform): string {
  return "val" in transform ? `${transform.op}:${transform.val}` : transform.op
}

function colorToken(color: Color): string {
  return [baseToken(color), ...(color.transforms ?? []).map(transformToken)].join(" ")
}

function tokenBase(token: string): Record<string, string> | null {
  const [kind, value, last] = token.split(":")
  if (value === undefined) return null
  if (kind === "system") return last === undefined ? null : { system: value, last }
  return last === undefined && kind !== undefined ? { [kind]: value } : null
}

function tokenTransform(token: string): Record<string, unknown> | null {
  const [op, val, extra] = token.split(":")
  if (val === undefined) return { op }
  return extra === undefined && integer.test(val) ? { op, val: Number(val) } : null
}

function readColorToken(value: string | undefined): Color | null {
  if (value === undefined) return null
  const [first = "", ...rest] = value.split(" ")
  const base = tokenBase(first)
  const transforms = rest.map(tokenTransform)
  if (base === null || transforms.includes(null)) return null
  return readColor(transforms.length === 0 ? base : { ...base, transforms }) ?? null
}

export function writeFormat(span: HTMLElement, format: RunPaint): void {
  for (const name of formatNames) {
    const set = format[name]
    if (set !== undefined) span.dataset[name] = String(set)
  }
  if (format.letterSpacing !== undefined) span.dataset.letterSpacing = String(format.letterSpacing)
  if (format.case !== undefined) span.dataset.case = format.case
  if (format.fill !== undefined) span.dataset.fill = JSON.stringify(format.fill)
  if (format.size !== undefined) span.dataset.size = String(format.size)
  if (format.color !== undefined) {
    span.dataset.color = colorToken(format.color)
  }
  if (format.link !== undefined) span.dataset.link = JSON.stringify(format.link)
  if (format.font !== undefined) span.dataset.font = format.font
}

export function readFormat(span: HTMLElement): RunPaint {
  let format: RunPaint = {}
  for (const name of formatNames) {
    const set = span.dataset[name]
    if (set === "true" || set === "false") format = { ...format, [name]: set === "true" }
  }
  const letterSpacing = span.dataset.letterSpacing
  if (letterSpacing !== undefined && integer.test(letterSpacing))
    format = { ...format, letterSpacing: Number(letterSpacing) }
  const letters = caseNames.find((name) => name === span.dataset.case)
  if (letters !== undefined) format = { ...format, case: letters }
  const rawLink = span.dataset.link
  if (rawLink !== undefined) {
    try {
      const link = readElementLink(JSON.parse(rawLink))
      if (link !== null) format = { ...format, link }
    } catch {}
  }
  const size = readSize(span.dataset.size)
  if (size !== null) format = { ...format, size }
  const color = readColorToken(span.dataset.color)
  if (color !== null) format = { ...format, color }
  if (span.dataset.fill !== undefined) {
    try {
      const fill = readTextFill(JSON.parse(span.dataset.fill))
      if (fill !== null) format = { ...format, fill }
    } catch {}
  }
  const font = span.dataset.font
  if (font !== undefined && font.trim() !== "") format = { ...format, font }
  return format
}

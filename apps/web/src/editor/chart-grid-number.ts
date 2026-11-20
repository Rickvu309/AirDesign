import type { ChartValue } from "@airdesign/document"
import { chartNumber } from "@airdesign/pptx"

const general = "General"
const exact = 12
const typedNoise = /[$,\s]/gu

function shares(format: string): boolean {
  return format.includes("%")
}

function trimmed(value: number): number {
  return Number(value.toPrecision(exact))
}

export function gridFormat(own: string | undefined, chart: ChartValue): string {
  if (own !== undefined && own.toLowerCase() !== general.toLowerCase()) return own
  const { labels } = chart
  if (labels === undefined || (chart.kind === "pie" && shares(labels))) return general
  return labels
}

export function gridNumber(value: number, format: string): string {
  const code = shares(format) && !format.includes(".") ? format.replace("0%", "0.0%") : format
  return chartNumber(value, code) ?? String(value)
}

export function gridParse(text: string, format: string): number | null {
  const plain = text.replace(typedNoise, "")
  const typedShare = plain.endsWith("%")
  const number = Number(typedShare ? plain.slice(0, -1) : plain)
  if (plain === "" || plain === "%" || !Number.isFinite(number)) return null
  if (typedShare || (shares(format) && Math.abs(number) >= 1)) return trimmed(number / 100)
  return number
}

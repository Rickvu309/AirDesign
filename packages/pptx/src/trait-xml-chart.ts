import { readChartValue, writeChartValue } from "@airdesign/document"
import { chartFormatsOf, chartValueOf } from "./chart-read.js"
import { chartPartOf, writeChart } from "./chart-write.js"
import { whole, type PartCodec, type TraitXml } from "./xml-codec.js"

export function fileChartValue(parts: ReadonlyMap<string, Uint8Array>, part: string, shape: string): string | null {
  try {
    const bytes = parts.get(chartPartOf(parts, part, shape))
    const chart = bytes === undefined ? null : chartValueOf(bytes)
    return chart === null ? null : writeChartValue(chart)
  } catch {
    return null
  }
}

export function fileChartFormats(
  parts: ReadonlyMap<string, Uint8Array>,
  part: string,
  shape: string,
): readonly string[] | null {
  try {
    const bytes = parts.get(chartPartOf(parts, part, shape))
    return bytes === undefined ? null : chartFormatsOf(bytes)
  } catch {
    return null
  }
}

const chartValue: PartCodec<string> = {
  read: (parts, at) => fileChartValue(parts, at.part, at.shape),
  write(parts, at, value) {
    const chart = readChartValue(value)
    return chart === null ? parts : writeChart(parts, at.part, at.shape, chart)
  },
}

export const chartXml: TraitXml<"chart"> = { slot: null, fields: { value: whole(chartValue) } }

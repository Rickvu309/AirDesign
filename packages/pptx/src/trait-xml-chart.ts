import { readChartValue, writeChartValue } from "@airdesign/document"
import { chartValueOf } from "./chart-read.js"
import { chartPartOf, writeChart } from "./chart-write.js"
import { whole, type PartCodec, type TraitXml } from "./xml-codec.js"

const chartValue: PartCodec<string> = {
  read(parts, at) {
    try {
      const bytes = parts.get(chartPartOf(parts, at.part, at.shape))
      const chart = bytes === undefined ? null : chartValueOf(bytes)
      return chart === null ? null : writeChartValue(chart)
    } catch {
      return null
    }
  },
  write(parts, at, value) {
    const chart = readChartValue(value)
    return chart === null ? parts : writeChart(parts, at.part, at.shape, chart)
  },
}

export const chartXml: TraitXml<"chart"> = { slot: null, fields: { value: whole(chartValue) } }

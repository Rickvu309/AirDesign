import { readChartValue } from "@airdesign/document"
import { writeChart } from "./chart-write.js"
import { whole, type PartCodec, type TraitXml } from "./xml-codec.js"

const chartValue: PartCodec<string> = {
  read() {
    return null
  },
  write(parts, at, value) {
    const chart = readChartValue(value)
    return chart === null ? parts : writeChart(parts, at.part, at.shape, chart)
  },
}

export const chartXml: TraitXml<"chart"> = { slot: null, fields: { value: whole(chartValue) } }

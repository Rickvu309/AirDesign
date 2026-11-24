import { measureWith } from "../index.js"
import interWidths from "./inter-widths.json" with { type: "json" }

export const interMeasure = measureWith(interWidths)

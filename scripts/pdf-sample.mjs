import path from "node:path"

const exported = (name, extension) => path.join(process.cwd(), "tests/browser", `exported-${name}.${extension}`)

export const sampleDeckPdf = exported("sample-deck", "pdf")
export const sampleDeckLines = exported("sample-deck", "json")
export const pathParityPdf = exported("path-parity", "pdf")
export const pathParityCanvas = exported("path-parity", "png")
export const chartDeckPdf = exported("chart-deck", "pdf")

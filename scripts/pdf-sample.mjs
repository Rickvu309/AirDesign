import path from "node:path"

const exported = (name) => path.join(process.cwd(), "tests/browser", `exported-sample-deck.${name}`)

export const sampleDeckPdf = exported("pdf")
export const sampleDeckLines = exported("json")

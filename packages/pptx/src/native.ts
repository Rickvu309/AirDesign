import PptxGenJS from "pptxgenjs"
import { importPptx, type Presentation } from "./index.ts"
import { readArchive, writeArchive } from "./archive.ts"
import { parseXml } from "./xml.ts"

export type NativeSlide = { title: string; table: { headers: string[]; rows: string[][] }; chart: { name: string; labels: string[]; values: number[] }; notes: string }
export async function createNativePresentation(slides: NativeSlide[]): Promise<Presentation> {
  if (slides.length === 0 || slides.length > 100) throw new Error("native-slide-limit")
  const pptx = new PptxGenJS()
  pptx.author = "AirDesign fixture"
  pptx.subject = "Generated locally; PowerPoint support unproven pending P09 X01"
  pptx.layout = "LAYOUT_WIDE"
  pptx.theme = { headFontFace: "Aptos", bodyFontFace: "Aptos" }
  for (const source of slides) {
    if (source.chart.labels.length !== source.chart.values.length || source.chart.values.some(value => !Number.isFinite(value))) throw new Error("invalid-native-chart")
    if (source.table.rows.some(row => row.length !== source.table.headers.length)) throw new Error("invalid-native-table")
    const slide = pptx.addSlide()
    slide.addText([{ text: source.title, options: { bold: true } }, { text: " / preserved sibling", options: { italic: true } }], { x: 0.5, y: 0.4, w: 11, h: 0.5, fontSize: 24 })
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.1, w: 3, h: 0.4, fill: { color: "2563EB" } })
    slide.addTable([source.table.headers, ...source.table.rows].map(row => row.map(text => ({ text }))), { x: 0.5, y: 2, w: 5, h: 2, fontSize: 16, border: { type: "solid", color: "808080", pt: 1 } })
    slide.addChart(pptx.ChartType.bar, [{ name: source.chart.name, labels: source.chart.labels, values: source.chart.values }], { x: 6, y: 2, w: 6, h: 3, showTitle: true, title: source.chart.name })
    slide.addNotes(source.notes)
  }
  const output = await pptx.write({ outputType: "nodebuffer" })
  if (!(output instanceof Uint8Array)) throw new Error("native-output-type")
  const parts = await readArchive(Buffer.from(output))
  for (const [name, bytes] of parts) if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
    const { xml, nodes } = parseXml(bytes)
    const objects = nodes.filter(node => node.local === "cNvPr" && node.uri === "http://schemas.openxmlformats.org/presentationml/2006/main")
    let normalized = xml
    for (let index = objects.length - 1; index >= 0; index--) {
      const node = objects[index]
      if (!node) throw new Error("native-object-required")
      normalized = normalized.slice(0, node.start) + xml.slice(node.start, node.openEnd).replace(/\bid="[^"]*"/, `id="${index + 1}"`) + normalized.slice(node.openEnd)
    }
    parts.set(name, Buffer.from(normalized))
  }
  const presentation = await importPptx(await writeArchive(parts))
  return presentation
}

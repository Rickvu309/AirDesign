import {readFile} from "node:fs/promises"
import {createHash} from "node:crypto"
import {importPptx} from "../../src/index.ts"
import {importedNativeDeck} from "../../src/import-deck.ts"
import {parseXml} from "../../src/xml.ts"
import {flatten} from "../../../deck/src/elements.ts"
import {nativeHistoryModel} from "../../../change-log/src/text/native-model.ts"

export async function corpusCoverage() {
  const {default: manifest} = await import("./manifest.json", {with: {type: "json"}})
  const results = []
  for (const entry of manifest.decks) {
    const bytes = await readFile(new URL(`./${entry.id}.pptx`, import.meta.url))
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256 || bytes.length !== entry.bytes) throw new Error(`corpus-hash-mismatch:${entry.id}`)
    const source = await importPptx(bytes), deck = importedNativeDeck(source)
    const boxes: string[] = [], editable: string[] = []
    for (const slide of deck.slides) {
      if (slide.source.kind !== "original") throw new Error("corpus-source-required")
      const part = slide.source.part, document = parseXml(source.parts.get(part)!)
      const texts = document.nodes.filter(node => node.local === "t" && node.uri.endsWith("/drawingml/2006/main")), bodies = document.nodes.filter(node => node.local === "txBody")
      for (const shape of document.nodes.filter(node => node.local === "sp")) {
        const within = (node: typeof shape) => node.start > shape.start && node.end < shape.end
        const body = bodies.find(within)
        if (!body) continue
        const identity = document.nodes.find(node => node.local === "cNvPr" && within(node))?.attributes.id
        if (!identity) throw new Error("corpus-shape-identity-required")
        const key = `${part}#${identity}`, spans = texts.filter(within)
        boxes.push(key)
        const sourceId = spans.length ? `text:${spans.map(node => texts.indexOf(node)).join(",")}` : `body:${bodies.indexOf(body)}`
        const element = flatten(slide.elements).find(element => element.source.kind === "original" && element.source.objectId === sourceId)
        if (element?.kind !== "text" || element.support.kind !== "native") continue
        const paragraph = element.body.paragraphs[0]
        const edit = nativeHistoryModel.apply(deck, {changes: [{kind: "set", target: paragraph.id, value: {...paragraph, alignment: paragraph.alignment === "left" ? "center" : "left"}}]})
        if (edit.ok) editable.push(key)
      }
    }
    if (new Set(boxes).size !== boxes.length || JSON.stringify(boxes) !== JSON.stringify(entry.boxes)) throw new Error(`corpus-denominator-mismatch:${entry.id}`)
    results.push({id: entry.id, boxes: boxes.length, baseline: entry.baselineNative.length, editable: editable.length, lost: entry.baselineNative.filter(key => !editable.includes(key)), pass: editable.length >= entry.baselineNative.length})
  }
  return results
}

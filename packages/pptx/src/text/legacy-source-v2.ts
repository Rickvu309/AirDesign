import {isDeepStrictEqual} from "node:util"
import type {Element} from "../../../deck/src/model.ts"
import type {TextBody} from "../../../deck/src/text/body.ts"
import {decodeLegacyRunsV2} from "../../../deck/src/text/legacy-v2.ts"
import {patchText, type Presentation} from "../index.ts"
import {parseXml} from "../xml.ts"
import {assertTextSupported, UnsupportedTextFormat} from "./cascade.ts"

export function bodyFormatting(body: TextBody) {
  return {frame: {...body.frame, id: undefined}, paragraphs: body.paragraphs.map(paragraph => ({...paragraph, id: undefined}))}
}
export function preserveLegacySourceV2(original: Presentation, legacy: Extract<Element, {kind: "text"}>, body: TextBody): Presentation | undefined {
  const baseline = decodeLegacyRunsV2(legacy.runs, body.frame.id, body.paragraphs[0].id)
  if (isDeepStrictEqual(bodyFormatting(body), bodyFormatting(baseline))) return original
  const structure = (value: TextBody) => ({...bodyFormatting(value), paragraphs: bodyFormatting(value).paragraphs.map(paragraph => ({...paragraph, runs: []}))})
  if (!isDeepStrictEqual(structure(body), structure(baseline))) return undefined
  if (legacy.source.kind !== "original") throw new UnsupportedTextFormat()
  const source = legacy.source, bytes = original.parts.get(source.part)
  if (!bytes) throw new UnsupportedTextFormat()
  const document = parseXml(bytes), spans = document.nodes.filter(node => node.local === "t" && node.uri.endsWith("/drawingml/2006/main"))
  const indices = source.objectId.slice(5).split(",").map(Number), first = spans[indices[0]!]
  const node = first && document.nodes.find(node => node.local === "txBody" && node.start < first.start && node.end > first.end)
  if (!node) throw new UnsupportedTextFormat()
  assertTextSupported(document, node)
  const current = body.paragraphs[0].runs, expected = baseline.paragraphs[0].runs
  if (current.length !== expected.length || current.some((run, index) => run.kind !== expected[index]!.kind || !isDeepStrictEqual(run.style, expected[index]!.style))) throw new UnsupportedTextFormat("legacy text span structure")
  let offset = 0, result = original
  for (const [index, run] of legacy.runs.entries()) {
    const fragments = run.text.split("\n")
    const value = fragments.map((fragment, position) => {
      if (position > 0) offset++
      const token = fragment ? current[offset++] : undefined
      if (token && token.kind !== "text" || token?.kind === "text" && /[\n\r\t]/.test(token.text)) throw new UnsupportedTextFormat("legacy text span structure")
      return token?.kind === "text" ? token.text : ""
    }).join("\n")
    const span = spans[indices[index]!], previous = spans[indices[index - 1]!]
    const paragraph = span && document.nodes.find(node => node.local === "p" && node.start < span.start && node.end > span.end)
    const separator = previous && paragraph && !(previous.start > paragraph.start && previous.end < paragraph.end)
    if (value !== run.text) result = patchText(result, source.part, indices[index]!, separator ? value.slice(1) : value)
  }
  return result
}

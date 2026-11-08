import type {Id, Run} from "../model.ts"
import {parseTextBody} from "./body-codec.ts"
import type {InlineRun, TextBody, TextStyle} from "./body.ts"

export function decodeLegacyRunsV2(runs: [Run, ...Run[]], frameId: Id, paragraphId: Id): TextBody {
  const inline: InlineRun[] = []
  for (const run of runs) {
    const {text, ...style} = run
    if (text.includes("\r")) throw new Error("legacy-carriage-return-needs-reconciliation")
    const parts = text.split("\n")
    parts.forEach((part, index) => {
      if (index > 0) inline.push({kind: "break", style: {...style}})
      if (part.length > 0) inline.push({kind: "text", text: part, style: {...style}})
    })
  }
  const last = runs[runs.length - 1]
  if (!last) throw new Error("invalid-legacy-runs")
  const endStyle: TextStyle = {font: last.font, size: last.size, color: last.color, bold: last.bold, ...(last.italic === undefined ? {} : {italic: last.italic}), ...(last.underline === undefined ? {} : {underline: last.underline})}
  return parseTextBody({frame: {id: frameId, kind: "text-frame", anchor: "top", insets: {top: 0, right: 0, bottom: 0, left: 0}, autofit: {kind: "none"}}, paragraphs: [{id: paragraphId, kind: "paragraph", runs: inline, endStyle, alignment: "left", level: 0, indentation: {left: 0, right: 0, firstLine: 0}, marker: {kind: "none"}, spacing: {before: 0, after: 0, line: {kind: "multiple", value: 1.2}}}]})
}

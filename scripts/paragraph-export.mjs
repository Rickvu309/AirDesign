import { freshBrowserExport } from "./browser-export.mjs"
import { judge } from "./judge.mjs"
import { browserExports, paragraphsExportName } from "./pptx-corpus.mjs"

export const paragraphsOriginalName = "doe-heat-pumps.pptx"
export const paragraphsExpected = {
  part: "ppt/slides/slide7.xml",
  shape: "45",
  value: [
    { from: 0, runs: [{ from: 0, text: "Vapor Compression Cycle" }] },
    { from: 1, runs: [{ from: 0, text: "Pumped refrigerant" }] },
    {
      from: 2,
      runs: [
        { from: 0, text: "Pressurized (liquid) " },
        { from: 1, text: "supplies" },
        { from: 2, text: " heat " },
      ],
    },
    {
      from: 3,
      runs: [
        { from: 0, text: "Depressurized (gas) " },
        { from: 1, text: "collects" },
        { from: 2, text: " heat " },
      ],
    },
    { from: 3, runs: [{ from: -1, text: "Extra line" }] },
  ],
}

export const freshExports = ({ deck, paragraphs, run }) => freshBrowserExport({ file: deck, also: [paragraphs], run })

export const judgedExportNames = (spec) => (spec.ok ? browserExports : [])

export const validatorFiles = ({ names, fixturePath, others }) => [...[...names].map(fixturePath), ...others]

export function paragraphExportLines({ pptx, parts, lists, ids, orders }) {
  const original = parts.get(paragraphsOriginalName)
  const exported = parts.get(paragraphsExportName)
  if (original === undefined || exported === undefined) throw new Error("paragraph export")
  const lines = pptx
    .paragraphExportFailures(original, exported, paragraphsExpected)
    .map((failure) => `paragraph export ${failure}`)
  const verdict = judge(
    pptx,
    {
      list: lists.get(paragraphsOriginalName),
      ids: ids.get(paragraphsOriginalName),
      orders: orders.get(paragraphsOriginalName),
    },
    {
      list: lists.get(paragraphsExportName),
      ids: ids.get(paragraphsExportName),
      orders: orders.get(paragraphsExportName),
    },
  )
  for (const error of verdict.errors) lines.push(`paragraph export validator ${error}`)
  for (const dupe of verdict.dupes) lines.push(`paragraph export duplicate shape id ${JSON.stringify(dupe)}`)
  return lines
}

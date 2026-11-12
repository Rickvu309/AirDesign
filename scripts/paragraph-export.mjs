import { freshBrowserExport } from "./browser-export.mjs"
import { judge } from "./judge.mjs"

export const paragraphsExportName = "exported-paragraphs.pptx"
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

export const boxExportName = "exported-box.pptx"
export const boxOriginalName = "clean.pptx"
export const boxExpected = {
  part: "ppt/slides/slide1.xml",
  shape: "2",
  element: "256.2",
  box: { x: 914400, y: 1371600, cx: 3657600, cy: 2743200 },
}
export const boxRoutes = [
  { name: "move", part: boxExpected.part, shape: boxExpected.shape, x: boxExpected.box.x, y: boxExpected.box.y },
  { name: "resize", part: boxExpected.part, shape: boxExpected.shape, cx: boxExpected.box.cx, cy: boxExpected.box.cy },
]

export const browserSpecs = ["tests/browser/thin-deck.spec.ts", "tests/browser/box-export.spec.ts"]

export const freshExports = ({ deck, paragraphs, box, run }) =>
  freshBrowserExport({ file: deck, also: [paragraphs, box], run })

export const judgedExportNames = (spec) => (spec.ok ? [paragraphsExportName, boxExportName] : [])

export const validatorFiles = ({ names, fixturePath, others }) => [...[...names].map(fixturePath), ...others]

function judgedExportLines({ pptx, parts, lists, ids, orders }, { label, original, exported, failures }) {
  const before = parts.get(original)
  const after = parts.get(exported)
  if (before === undefined || after === undefined) throw new Error(label)
  const lines = failures(pptx, before, after).map((failure) => `${label} ${failure}`)
  const verdict = judge(
    pptx,
    { list: lists.get(original), ids: ids.get(original), orders: orders.get(original) },
    { list: lists.get(exported), ids: ids.get(exported), orders: orders.get(exported) },
  )
  for (const error of verdict.errors) lines.push(`${label} validator ${error}`)
  for (const dupe of verdict.dupes) lines.push(`${label} duplicate shape id ${JSON.stringify(dupe)}`)
  return lines
}

export const paragraphExportLines = (answers) =>
  judgedExportLines(answers, {
    label: "paragraph export",
    original: paragraphsOriginalName,
    exported: paragraphsExportName,
    failures: (pptx, before, after) => pptx.paragraphExportFailures(before, after, paragraphsExpected),
  })

export const boxExportLines = (answers) =>
  judgedExportLines(answers, {
    label: "box export",
    original: boxOriginalName,
    exported: boxExportName,
    failures: (pptx, before, after) => pptx.routeExportFailures(before, after, boxRoutes),
  })

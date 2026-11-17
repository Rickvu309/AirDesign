import { slideExportLines } from "./slide-export.mjs"

const shared = ["[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"]

export const notesExports = [
  {
    original: "empty.pptx",
    exported: "exported-notes.pptx",
    changed: [...shared, "ppt/slides/_rels/slide1.xml.rels"],
    notes: [
      "Open with the result & thank the team.\nThen the plan.",
      "Pause here for questions.",
      "Close on the next step.",
    ],
  },
  {
    original: "nasa-1d-cnn.pptx",
    exported: "exported-notes-imported.pptx",
    changed: [...shared, "ppt/slides/_rels/slide2.xml.rels"],
    notes: ["", "The copy keeps its own notes.", "A first note on the second slide."],
  },
]

export const notesExportNames = notesExports.map((row) => row.exported)

export function notesExportLines({ pptx, parts, lists, ids, orders }) {
  return notesExports.flatMap((row) => {
    const before = parts.get(row.original)
    const after = parts.get(row.exported)
    if (before === undefined || after === undefined) throw new Error("notes export")
    const label = `notes export ${row.exported}`
    const written = new Map(pptx.readNotes(after).map((notes) => [notes.slide, notes.text]))
    const shown = pptx
      .readSlides(after)
      .slice(0, row.notes.length)
      .map((slide) => written.get(slide.slide) ?? null)
    return [
      ...slideExportLines({
        pptx,
        parts,
        lists,
        ids,
        orders,
        original: row.original,
        exported: row.exported,
        kept: [...before.keys()].filter((name) => !row.changed.includes(name)),
      }).map((line) => `${label} ${line}`),
      ...pptx.notesLinkFailures(after).map((failure) => `${label} broken link ${failure}`),
      ...(JSON.stringify(shown) === JSON.stringify(row.notes) ? [] : [`${label} notes ${JSON.stringify(shown)}`]),
    ]
  })
}

export const blankOriginalName = "blank.pptx"
export const blankExportName = "exported-blank.pptx"
export const blankTitle = "My first deck"
export const blankCase = {
  name: "blank-title-export",
  before: blankOriginalName,
  after: blankExportName,
  visible: true,
  targeted: [1],
  errors: 0,
  dupes: 0,
  pages: true,
}

export function blankExportLines({ pptx, parts, lists }) {
  const before = parts.get(blankOriginalName)
  const after = parts.get(blankExportName)
  if (before === undefined || after === undefined) throw new Error("blank export")
  const lines = []
  for (const name of [blankOriginalName, blankExportName]) {
    const errors = lists.get(name)
    if (errors === undefined) lines.push(`${name} has no validator result`)
    else for (const error of errors) lines.push(`${name} validator ${error}`)
  }
  return [
    ...lines,
    ...pptx
      .routeExportFailures(before, after, [
        {
          name: "text",
          part: "ppt/slides/slide1.xml",
          shape: "2",
          value: [{ from: 0, runs: [{ from: -1, text: blankTitle }] }],
        },
      ])
      .map((line) => `blank export ${line}`),
  ]
}

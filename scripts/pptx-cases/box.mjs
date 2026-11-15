import { boxExportLines, boxExportName } from "../paragraph-export.mjs"
import { slideExportLines } from "../slide-export.mjs"

export const boxTurnedExportName = "exported-box-turned.pptx"
export const boxTurnedXfrm =
  '<a:xfrm rot="1800000"><a:off x="574236" y="589182"/><a:ext cx="5861929" cy="1260035"/></a:xfrm>'

const turnedOriginal = "clean.pptx"
const slide = "ppt/slides/slide1.xml"

function turnedLines(answers) {
  const kept = [...(answers.parts.get(turnedOriginal)?.keys() ?? [])].filter((name) => name !== slide)
  const lines = slideExportLines({ ...answers, original: turnedOriginal, exported: boxTurnedExportName, kept }).map(
    (line) => line.replace(/^slide export/, "turned box export"),
  )
  const bytes = answers.parts.get(boxTurnedExportName)?.get(slide)
  const text = bytes === undefined ? "" : new TextDecoder().decode(bytes)
  if (!text.includes(boxTurnedXfrm)) lines.push(`turned box export ${slide} did not write the resized turned box`)
  return lines
}

export default {
  specs: ["tests/browser/box-export.spec.ts", "tests/browser/gesture-size.spec.ts"],
  exports: [boxExportName, boxTurnedExportName],
  covers: ["box.x", "box.y", "box.w", "box.h"],
  lines: (answers) => [...boxExportLines(answers), ...turnedLines(answers)],
}

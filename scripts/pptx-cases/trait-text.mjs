import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const exported = "exported-text-type.pptx"
const slide = "ppt/slides/slide1.xml"
const run =
  '<a:pPr><a:lnSpc><a:spcPct val="150000"/></a:lnSpc><a:spcBef><a:spcPts val="1200"/></a:spcBef><a:spcAft><a:spcPts val="600"/></a:spcAft></a:pPr><a:r><a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill><a:latin typeface="Georgia"/></a:rPr><a:t>Hello</a:t></a:r>'

export default {
  specs: ["tests/browser/text-layout.spec.ts"],
  exports: [exported],
  cases: [
    {
      name: "browser-text-type",
      before: original,
      after: exported,
      visible: true,
      targeted: [1],
      errors: 0,
      dupes: 0,
      pages: true,
    },
  ],
  renders: [exported],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "text type"),
    )
    const after = new TextDecoder().decode(answers.parts.get(exported)?.get(slide) ?? new Uint8Array())
    if (!after.includes(run)) lines.push("text type did not write the font face and the paragraph's spacing")
    return lines
  },
}

import { slideExportLines } from "../slide-export.mjs"

const exported = "exported-slide-background.pptx"
const slide = "ppt/slides/slide1.xml"
const written =
  '<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="dk2"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'

export default {
  specs: ["tests/browser/slide-background.spec.ts"],
  exports: [exported],
  renders: [exported],
  lines(answers) {
    const kept = [...(answers.parts.get("blank.pptx")?.keys() ?? [])].filter((name) => name !== slide)
    const bytes = answers.parts.get(exported)?.get(slide)
    const text = bytes === undefined ? "" : new TextDecoder().decode(bytes)
    return [
      ...slideExportLines({ ...answers, original: "blank.pptx", exported, kept }).map((line) =>
        line.replace(/^slide export/, "slide background"),
      ),
      ...(text.includes(written) ? [] : ["slide background did not write the slide's own p:bg first in p:cSld"]),
    ]
  },
}

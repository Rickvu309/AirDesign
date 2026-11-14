import { slideExportLines } from "../slide-export.mjs"

const exported = "exported-color-transforms.pptx"
const slide = "ppt/slides/slide1.xml"
const written =
  '<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr></a:solidFill><a:effectLst/></p:bgPr></p:bg>'

export default {
  specs: ["tests/browser/color-transforms.spec.ts"],
  exports: [exported],
  renders: [exported],
  lines(answers) {
    const kept = [...(answers.parts.get("blank.pptx")?.keys() ?? [])].filter((name) => name !== slide)
    const bytes = answers.parts.get(exported)?.get(slide)
    const text = bytes === undefined ? "" : new TextDecoder().decode(bytes)
    return [
      ...slideExportLines({ ...answers, original: "blank.pptx", exported, kept }).map((line) =>
        line.replace(/^slide export/, "color transforms"),
      ),
      ...(text.includes(written) ? [] : ["color transforms did not keep the background's theme slot and lumMod"]),
    ]
  },
}

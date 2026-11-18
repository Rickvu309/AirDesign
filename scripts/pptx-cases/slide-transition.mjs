import { slideExportLines } from "../slide-export.mjs"

const exported = "exported-slide-transition.pptx"
const slide = "ppt/slides/slide1.xml"
const written =
  '<p:transition xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" spd="fast" p14:dur="500"><p:fade/></p:transition>'

export default {
  specs: ["tests/browser/slide-transition.spec.ts"],
  exports: [exported],
  covers: ["transition.value"],
  lines(answers) {
    const kept = [...(answers.parts.get("blank.pptx")?.keys() ?? [])].filter((name) => name !== slide)
    const bytes = answers.parts.get(exported)?.get(slide)
    const text = bytes === undefined ? "" : new TextDecoder().decode(bytes)
    return [
      ...slideExportLines({ ...answers, original: "blank.pptx", exported, kept }),
      ...(text.includes(written) ? [] : ["slide transition did not write dissolve as p:fade"]),
    ]
  },
}

import { slideExportLines } from "../slide-export.mjs"

const exported = "exported-smart-animate.pptx"
const slide = "ppt/slides/slide1.xml"
const morph =
  '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159"><p:transition xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" spd="slow" p14:dur="3000"><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>'

export default {
  specs: ["tests/browser/smart-animate.spec.ts"],
  exports: [exported],
  covers: ["transition.value"],
  lines(answers) {
    const kept = [...(answers.parts.get("blank.pptx")?.keys() ?? [])].filter((name) => name !== slide)
    const bytes = answers.parts.get(exported)?.get(slide)
    const text = bytes === undefined ? "" : new TextDecoder().decode(bytes)
    return [
      ...slideExportLines({ ...answers, original: "blank.pptx", exported, kept }),
      ...(text.includes(morph) ? [] : ["Smart animate did not write PowerPoint's Morph with its fade fallback"]),
    ]
  },
}

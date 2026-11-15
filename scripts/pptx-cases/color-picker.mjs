import { slideExportLines } from "../slide-export.mjs"

export const colorPickerExport = "exported-color-picker.pptx"

export const colorPickerWritten = [
  '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="60000"/><a:lumOff val="40000"/></a:schemeClr></a:solidFill></p:spPr>',
  '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="1F4E79"/></a:solidFill></p:spPr>',
]

const original = "shapes-added.pptx"
const slide = "ppt/slides/slide1.xml"

export default {
  specs: ["tests/browser/control-color.spec.ts"],
  exports: [colorPickerExport],
  renders: [colorPickerExport],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    const bytes = answers.parts.get(colorPickerExport)?.get(slide)
    const text = bytes === undefined ? "" : new TextDecoder().decode(bytes)
    return [
      ...slideExportLines({ ...answers, original, exported: colorPickerExport, kept }).map((line) =>
        line.replace(/^slide export/, "color picker"),
      ),
      ...colorPickerWritten
        .filter((written) => !text.includes(written))
        .map((written) => `color picker did not write ${written}`),
    ]
  },
}

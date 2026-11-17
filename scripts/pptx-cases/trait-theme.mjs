import { slideExportLines } from "../slide-export.mjs"

const original = "doe-heat-pumps.pptx"
const exported = "exported-theme.pptx"
const themes = ["ppt/theme/theme1.xml", "ppt/theme/theme2.xml"]
const accent = '<a:accent1><a:srgbClr val="C00000"/></a:accent1>'
const heading = '<a:majorFont><a:latin typeface="Georgia" panose="020F0302020204030204"/>'

export default {
  specs: ["tests/browser/theme.spec.ts"],
  exports: [exported],
  renders: [exported],
  covers: [
    "theme.dk1",
    "theme.lt1",
    "theme.dk2",
    "theme.lt2",
    "theme.accent1",
    "theme.accent2",
    "theme.accent3",
    "theme.accent4",
    "theme.accent5",
    "theme.accent6",
    "theme.hlink",
    "theme.folHlink",
    "theme.major",
    "theme.minor",
  ],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => !themes.includes(name))
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "theme"),
    )
    for (const theme of themes) {
      const bytes = answers.parts.get(exported)?.get(theme)
      const text = bytes === undefined ? "" : new TextDecoder().decode(bytes)
      if (!text.includes(accent)) lines.push(`theme ${theme} did not write accent 1 as C00000`)
      if (!text.includes(heading)) lines.push(`theme ${theme} did not write Georgia as the heading font`)
    }
    return lines
  },
}

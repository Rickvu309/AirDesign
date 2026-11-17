import { slideExportLines } from "../slide-export.mjs"

const original = "doe-heat-pumps.pptx"
const exported = "exported-template-style.pptx"

export default {
  specs: ["tests/browser/template-style.spec.ts"],
  exports: [exported],
  renders: [exported],
  covers: ["template.id", "theme.name"],
  lines(answers) {
    const allowed = new Set([
      "[Content_Types].xml",
      "ppt/presentation.xml",
      "ppt/_rels/presentation.xml.rels",
      "ppt/slides/_rels/slide1.xml.rels",
      "ppt/theme/theme2.xml",
    ])
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => !allowed.has(name))
    const lines = slideExportLines({ ...answers, original, exported, kept })
    const theme = new TextDecoder().decode(answers.parts.get(exported)?.get("ppt/theme/theme2.xml"))
    if (!theme.includes('name="Dark slides"')) lines.push("template style did not preserve its edited name")
    const counts = (parts) => {
      const ids = new Map()
      for (const [name, bytes] of parts ?? []) {
        if (name !== "ppt/presentation.xml" && !/^ppt\/slideMasters\/[^/]+\.xml$/.test(name)) continue
        for (const match of new TextDecoder()
          .decode(bytes)
          .matchAll(/<p:sld(?:Layout|Master)Id\b[^>]*\bid=(["'])([0-9]+)\1/g))
          ids.set(match[2], (ids.get(match[2]) ?? 0) + 1)
      }
      return ids
    }
    const before = counts(answers.parts.get(original))
    for (const [id, count] of counts(answers.parts.get(exported)))
      if (count > Math.max(1, before.get(id) ?? 0)) lines.push(`template style repeated native identifier ${id}`)
    return lines
  },
}

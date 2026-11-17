import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const slide = "ppt/slides/slide1.xml"
const features = {
  strike: 'strike="sngStrike"',
  "letter-spacing": 'spc="-64"',
  numbers: '<a:buAutoNum type="arabicPeriod"/>',
}
const exports = Object.keys(features).map((feature) => `exported-${feature}.pptx`)

export default {
  covers: ["text.strike", "text.letterSpacing", "text.list"],
  specs: ["tests/browser/text-fields.spec.ts"],
  exports,
  cases: exports.map((after) => ({
    name: after,
    before: original,
    after,
    visible: true,
    targeted: [1],
    errors: 0,
    dupes: 0,
    pages: true,
  })),
  renders: exports,
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    return Object.entries(features).flatMap(([feature, native]) => {
      const exported = `exported-${feature}.pptx`
      const lines = slideExportLines({ ...answers, original, exported, kept })
      const xml = new TextDecoder().decode(answers.parts.get(exported)?.get(slide) ?? new Uint8Array())
      if (!xml.includes(native)) lines.push(`${feature} did not write its native PowerPoint field`)
      return lines
    })
  },
}

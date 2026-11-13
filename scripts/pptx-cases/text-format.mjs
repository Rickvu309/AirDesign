const exportName = "exported-text-format.pptx"
const slide = "ppt/slides/slide1.xml"

function sameBytes(left, right) {
  if (left === undefined || right === undefined || left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  return true
}

export default {
  specs: ["tests/browser/text-style.spec.ts"],
  exports: [exportName],
  cases: [
    {
      name: "browser-text-format",
      before: "clean.pptx",
      after: exportName,
      visible: true,
      targeted: [1],
      errors: 0,
      dupes: 0,
      pages: true,
    },
  ],
  renders: [exportName],
  lines: ({ parts }) => {
    const clean = parts.get("clean.pptx")
    const exported = parts.get(exportName)
    if (clean === undefined || exported === undefined) return ["text format export is missing"]
    const xml = new TextDecoder().decode(exported.get(slide) ?? new Uint8Array())
    const lines = []
    if (!xml.includes('sz="3300"')) lines.push("text format export did not write the font size")
    if (!xml.includes('<a:schemeClr val="accent2"/>')) lines.push("text format export did not write the theme colour")
    if (!xml.includes('<a:schemeClr val="dk1"/>')) lines.push("text format export dropped the untouched colour")
    if (!xml.includes('algn="ctr"')) lines.push("text format export did not write alignment")
    if (!xml.includes('<a:buChar char="•"/>')) lines.push("text format export did not write a bullet")
    if (!xml.includes("<a:t>Hello </a:t>") || !xml.includes("<a:t>world</a:t>")) {
      lines.push("text format export changed words it does not own")
    }
    for (const [name, bytes] of clean) {
      if (name === slide) continue
      if (!sameBytes(bytes, exported.get(name))) lines.push(`text format export changed ${name}`)
    }
    return lines
  },
}

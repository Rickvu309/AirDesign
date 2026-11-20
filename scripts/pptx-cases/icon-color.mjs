const original = "picture-png.pptx"
const exported = "exported-icon-color.pptx"
const slide = "ppt/slides/slide1.xml"
const rels = "ppt/slides/_rels/slide1.xml.rels"

export default {
  specs: ["tests/browser/icon-color.spec.ts"],
  exports: [exported],
  covers: ["fills.color"],
  cases: [
    {
      name: "browser-icon-color",
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
    const after = answers.parts.get(exported)
    if (!after) return ["icon color export missing"]
    const decode = (part) => new TextDecoder().decode(after.get(part) ?? new Uint8Array())
    const lines = []
    const svg = [...after.keys()].find((name) => /^ppt\/media\/icon-rocket\.c[0-9A-F]{6}\.accent1\.svg$/.test(name))
    if (svg === undefined) return ["icon color did not write the rocket's SVG in Accent 1"]
    const hex = svg.slice("ppt/media/icon-rocket.c".length, -".accent1.svg".length)
    if (!decode(rels).includes(`Target="../media/${svg.slice("ppt/media/".length)}"`))
      lines.push("icon color did not link its SVG")
    if (!decode(svg).includes(`stroke="#${hex}"`)) lines.push("icon color did not draw the SVG in its color")
    const fallback = after.get(svg.replace(/\.svg$/, ".png"))
    if (fallback === undefined || new TextDecoder().decode(fallback.subarray(1, 4)) !== "PNG")
      lines.push("icon color did not write the PNG fallback")
    const shown = answers.pptx.shownImage(after, { slide: "256", part: slide, shape: "5" })
    if (shown?.source !== "rocket" || shown?.color?.scheme !== "accent1")
      lines.push("icon color does not read back as rocket in Accent 1")
    const kept = [...(answers.parts.get(original) ?? [])].filter(
      ([name, bytes]) =>
        ![slide, rels, "[Content_Types].xml"].includes(name) &&
        !Buffer.from(bytes).equals(Buffer.from(after.get(name) ?? [])),
    )
    if (kept.length > 0) lines.push(`icon color changed untouched parts: ${kept.map(([name]) => name).join(", ")}`)
    return lines
  },
}

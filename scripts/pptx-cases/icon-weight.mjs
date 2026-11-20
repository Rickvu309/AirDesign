const original = "picture-png.pptx"
const exported = "exported-icon-weight.pptx"
const slide = "ppt/slides/slide1.xml"
const rels = "ppt/slides/_rels/slide1.xml.rels"
const drawn = /^ppt\/media\/icon-rocket\.w150(?:\.c[0-9A-F]{6}\.tx1)?\.svg$/

export default {
  specs: ["tests/browser/icon-weight.spec.ts"],
  exports: [exported],
  covers: ["fills.weight"],
  cases: [
    {
      name: "browser-icon-weight",
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
    if (!after) return ["icon weight export missing"]
    const decode = (part) => new TextDecoder().decode(after.get(part) ?? new Uint8Array())
    const lines = []
    const svg = [...after.keys()].find((name) => drawn.test(name))
    if (svg === undefined) return ["icon weight did not write the rocket's SVG at 1.5"]
    const png = svg.replace(/\.svg$/, ".png")
    const links = decode(rels)
    if (!links.includes(`Target="../${svg.slice("ppt/".length)}"`)) lines.push("icon weight did not link its SVG")
    if (!links.includes(`Target="../${png.slice("ppt/".length)}"`)) lines.push("icon weight did not link its PNG")
    if (!decode(svg).includes('stroke-width="1.5"')) lines.push("icon weight did not draw the SVG at 1.5")
    const fallback = after.get(png)
    if (fallback === undefined || new TextDecoder().decode(fallback.subarray(1, 4)) !== "PNG")
      lines.push("icon weight did not write the PNG fallback")
    const shown = answers.pptx.shownImage(after, { slide: "256", part: slide, shape: "5" })
    if (shown?.source !== "rocket" || shown?.weight !== 150)
      lines.push("icon weight does not read back as rocket at 1.5")
    const kept = [...(answers.parts.get(original) ?? [])].filter(
      ([name, bytes]) =>
        ![slide, rels, "[Content_Types].xml"].includes(name) &&
        !Buffer.from(bytes).equals(Buffer.from(after.get(name) ?? [])),
    )
    if (kept.length > 0) lines.push(`icon weight changed untouched parts: ${kept.map(([name]) => name).join(", ")}`)
    return lines
  },
}

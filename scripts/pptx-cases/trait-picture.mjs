import { slideExportLines } from "../slide-export.mjs"

const original = "picture-png.pptx"
const exported = "exported-picture.pptx"
const slide = "ppt/slides/slide1.xml"
const rels = "ppt/slides/_rels/slide1.xml.rels"
const types = "[Content_Types].xml"
const drawn = /^ppt\/media\/icon-rocket(?:\.c[0-9A-F]{6}\.tx1)?\.svg$/
const photo =
  '<p:blipFill><a:blip r:embed="rId2"><a:alphaModFix amt="60000"/><a:grayscl/></a:blip><a:srcRect l="10000" r="10000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
const frame = '<a:off x="4267200" y="1905000"/><a:ext cx="3657600" cy="3048000"/>'
const named = '<p:cNvPr id="4" name="Sales chart" descr="A bar chart of sales by region"/>'
const hidden = '<p:cNvPr id="3" name="subTitle 1" hidden="1"/>'
const icon =
  /<p:blipFill><a:blip r:embed="(rId\d+)"><a:extLst><a:ext uri="\{96DAC541-7B7A-43D3-8B79-37D633B846F1\}"><asvg:svgBlip xmlns:asvg="http:\/\/schemas\.microsoft\.com\/office\/drawing\/2016\/SVG\/main" r:embed="(rId\d+)"\/><\/a:ext><\/a:extLst><\/a:blip>/

export default {
  specs: ["tests/browser/picture-design.spec.ts"],
  exports: [exported],
  cases: [
    {
      name: "browser-picture",
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
  covers: [
    "fills.source",
    "fills.recolor",
    "fills.alpha",
    "fills.crop",
    "identity.name",
    "identity.alt",
    "identity.hidden",
  ],
  lines(answers) {
    const after = answers.parts.get(exported)
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => ![slide, rels, types].includes(name))
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "picture"),
    )
    const decode = (part) => new TextDecoder().decode(after?.get(part) ?? new Uint8Array())
    const xml = decode(slide)
    if (!xml.includes(photo))
      lines.push("picture did not write the crop, the grayscale and the opacity into the photo's blip")
    if (!xml.includes(frame)) lines.push("picture did not move the photo's frame with its crop")
    if (!xml.includes(named)) lines.push("picture did not write the photo's name and alt text")
    if (!xml.includes(hidden)) lines.push("picture did not hide the subtitle")
    const svg = [...(after?.keys() ?? [])].find((name) => drawn.test(name)) ?? "ppt/media/icon-rocket.svg"
    const png = svg.replace(/\.svg$/, ".png")
    const linked = icon.exec(xml)
    const links = decode(rels)
    if (linked === null) lines.push("picture did not write the icon's PNG blip with its SVG in svgBlip")
    else {
      if (
        !links.includes(
          `Id="${linked[1]}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../${png.slice("ppt/".length)}"`,
        )
      )
        lines.push("picture did not link the icon's blip to its PNG")
      if (
        !links.includes(
          `Id="${linked[2]}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../${svg.slice("ppt/".length)}"`,
        )
      )
        lines.push("picture did not link the icon's svgBlip to its SVG")
    }
    if (!decode(svg).startsWith('<svg xmlns="http://www.w3.org/2000/svg"'))
      lines.push("picture did not write the icon's SVG part")
    const fallback = after?.get(png)
    if (fallback === undefined || new TextDecoder().decode(fallback.subarray(1, 4)) !== "PNG")
      lines.push("picture did not write the icon's PNG fallback")
    if (!decode(types).includes('<Default Extension="svg" ContentType="image/svg+xml"/>'))
      lines.push("picture did not type the SVG part")
    const shown = answers.pptx.shownImage(after, { slide: "256", part: slide, shape: "5" })
    if (shown?.source !== "rocket") lines.push("picture does not read the icon it wrote")
    return lines
  },
}

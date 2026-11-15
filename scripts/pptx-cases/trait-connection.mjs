import { slideExportLines } from "../slide-export.mjs"

const original = "census-updating-spm.pptx"
const exported = "exported-connection.pptx"
const slide = "ppt/slides/slide10.xml"
const untouched = ["ppt/slides/slide7.xml", "ppt/slides/slide8.xml", "ppt/slides/slide9.xml"]
const bound = '<a:stCxn id="6" idx="2"/><a:endCxn id="15" idx="3"/>'
const connectors = /<p:cxnSp>.*?<\/p:cxnSp>/gs

function placeOf(text, id) {
  const at = text.indexOf(`<p:cNvPr id="${id}"`)
  const start = text.indexOf("<a:xfrm", at)
  const xfrm = text.slice(start, text.indexOf("</a:xfrm>", start))
  const number = (name) => Number(new RegExp(`\\b${name}="(-?\\d+)"`).exec(xfrm)?.[1])
  return {
    x: number("x"),
    y: number("y"),
    cx: number("cx"),
    cy: number("cy"),
    flipH: xfrm.includes('flipH="1"'),
    flipV: xfrm.includes('flipV="1"'),
  }
}

function near(left, right) {
  return Math.abs(left.x - right.x) <= 1 && Math.abs(left.y - right.y) <= 1
}

export default {
  specs: ["tests/browser/connector-ends.spec.ts"],
  exports: [exported],
  renders: [exported],
  covers: ["connection.start", "connection.end"],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "connection"),
    )
    const decode = (deck, part) => new TextDecoder().decode(answers.parts.get(deck)?.get(part) ?? new Uint8Array())
    const after = decode(exported, slide)
    if (!after.includes(bound)) lines.push("connection did not bind the line's end to site 3 of the moved picture")
    const line = after.match(connectors)?.[0] ?? ""
    if (!line.includes('<a:prstGeom prst="line">')) lines.push("connection changed the bound connector's line preset")
    const connector = placeOf(after, "26")
    const start = {
      x: connector.flipH ? connector.x + connector.cx : connector.x,
      y: connector.flipV ? connector.y + connector.cy : connector.y,
    }
    const end = {
      x: connector.flipH ? connector.x : connector.x + connector.cx,
      y: connector.flipV ? connector.y : connector.y + connector.cy,
    }
    const picture = placeOf(after, "6")
    const card = placeOf(after, "15")
    if (!near(start, { x: picture.x + picture.cx / 2, y: picture.y + picture.cy }))
      lines.push("connection left the line's start off the picture's bottom site")
    if (!near(end, { x: card.x + card.cx, y: card.y + card.cy / 2 }))
      lines.push("connection left the line's end off the moved picture's right site")
    if (card.x === 3948437 && card.y === 4728663) lines.push("connection did not move the picture the line ends on")
    for (const part of untouched) {
      const was = decode(original, part).match(connectors)
      const now = decode(exported, part).match(connectors)
      if (was === null || JSON.stringify(was) !== JSON.stringify(now))
        lines.push(`connection changed the connector PowerPoint routed on ${part}`)
    }
    return lines
  },
}

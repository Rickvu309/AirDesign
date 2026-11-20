import { slideExportLines } from "../slide-export.mjs"

const original = "census-updating-spm.pptx"
const exported = "exported-connection.pptx"
const elbowOriginal = "connectors.pptx"
const elbowExported = "exported-elbow.pptx"
const elbowSlide = "ppt/slides/slide1.xml"
const arrowOriginal = "shapes-added.pptx"
const arrowExported = "exported-agent-arrow.pptx"
const clearance = 228600
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
    rot: number("rot") || 0,
    flipH: xfrm.includes('flipH="1"'),
    flipV: xfrm.includes('flipV="1"'),
  }
}

function endsOf(place) {
  const angle = (place.rot / 60000) * (Math.PI / 180)
  const half = { x: (place.flipH ? -place.cx : place.cx) / 2, y: (place.flipV ? -place.cy : place.cy) / 2 }
  const turned = {
    x: half.x * Math.cos(angle) - half.y * Math.sin(angle),
    y: half.x * Math.sin(angle) + half.y * Math.cos(angle),
  }
  const middle = { x: place.x + place.cx / 2, y: place.y + place.cy / 2 }
  return {
    start: { x: middle.x - turned.x, y: middle.y - turned.y },
    end: { x: middle.x + turned.x, y: middle.y + turned.y },
  }
}

function adjustOf(text, id) {
  const at = text.indexOf(`<p:cNvPr id="${id}"`)
  const shape = text.slice(at, text.indexOf("</p:cxnSp>", at))
  if (!shape.includes('<a:prstGeom prst="bentConnector3">')) return null
  return Number(/name="adj1" fmla="val (-?\d+)"/.exec(shape)?.[1])
}

function elbowLines(answers, decode) {
  const kept = [...(answers.parts.get(elbowOriginal)?.keys() ?? [])].filter((name) => name !== elbowSlide)
  const lines = slideExportLines({ ...answers, original: elbowOriginal, exported: elbowExported, kept }).map((line) =>
    line.replace(/^slide export/, "elbow connection"),
  )
  const after = decode(elbowExported, elbowSlide)
  const plan = placeOf(after, "2")
  const build = placeOf(after, "3")
  if (build.y === 3810000) lines.push("elbow connection did not move Build")
  const sites = {
    right: { x: plan.x + plan.cx, y: plan.y + plan.cy / 2 },
    left: { x: build.x, y: build.y + build.cy / 2 },
    planBottom: { x: plan.x + plan.cx / 2, y: plan.y + plan.cy },
    buildBottom: { x: build.x + build.cx / 2, y: build.y + build.cy },
  }
  const between = endsOf(placeOf(after, "4"))
  const under = endsOf(placeOf(after, "5"))
  if (!near(between.start, sites.right) || !near(between.end, sites.left))
    lines.push("elbow connection left the elbow between Plan and Build off their right and left sites")
  if (!near(under.start, sites.planBottom) || !near(under.end, sites.buildBottom))
    lines.push("elbow connection left the elbow under Plan and Build off their bottom sites")
  if (adjustOf(after, "4") !== 50000) lines.push("elbow connection moved the bend between Plan and Build off midway")
  const w = Math.abs(sites.buildBottom.y - sites.planBottom.y)
  if (adjustOf(after, "5") !== Math.round(((w + clearance) * 100000) / w))
    lines.push("elbow connection did not turn the elbow under both shapes past Build by the clearance")
  if (!after.includes('<a:stCxn id="2" idx="3"/><a:endCxn id="3" idx="1"/>'))
    lines.push("elbow connection lost the binding between Plan and Build")
  return lines
}

function arrowLines(answers, decode) {
  const kept = [...(answers.parts.get(arrowOriginal)?.keys() ?? [])].filter((name) => name !== elbowSlide)
  const lines = slideExportLines({ ...answers, original: arrowOriginal, exported: arrowExported, kept }).map((line) =>
    line.replace(/^slide export/, "agent arrow"),
  )
  const after = decode(arrowExported, elbowSlide)
  if (!after.includes('<a:stCxn id="4" idx="3"/><a:endCxn id="5" idx="2"/>'))
    lines.push("agent arrow did not bind the rectangle's right site to the oval's left site")
  if (!after.includes('<a:tailEnd type="triangle"/>')) lines.push("agent arrow lost its arrowhead")
  const rectangle = placeOf(after, "4")
  const oval = placeOf(after, "5")
  if (oval.x === 4114800 && oval.y === 1371600) lines.push("agent arrow did not move the oval it ends on")
  const ends = endsOf(placeOf(after, "7"))
  if (!near(ends.start, { x: rectangle.x + rectangle.cx, y: rectangle.y + rectangle.cy / 2 }))
    lines.push("agent arrow left its start off the rectangle's right site")
  if (!near(ends.end, { x: oval.x, y: oval.y + oval.cy / 2 }))
    lines.push("agent arrow left its end off the moved oval's left site")
  return lines
}

function near(left, right) {
  return Math.abs(left.x - right.x) <= 1 && Math.abs(left.y - right.y) <= 1
}

export default {
  specs: ["tests/browser/connector-ends.spec.ts", "tests/browser/agent-arrow.spec.ts"],
  exports: [exported, elbowExported, arrowExported],
  originals: [elbowOriginal, arrowOriginal],
  renders: [exported, elbowExported, arrowExported],
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
    return [...lines, ...elbowLines(answers, decode), ...arrowLines(answers, decode)]
  },
}

import {
  connectorEnds,
  decide,
  elbowClearance,
  routed,
  siteTie,
  elementId,
  format,
  openRegister,
  outlineOf,
  sitePoint,
  type Command,
  type ElementId,
  type ElementPatch,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { routedParts } from "./connector-route.js"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readSlides } from "./read-shapes.js"
import { shownConnection } from "./trait-xml-connection.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const part = "ppt/slides/slide10.xml"

async function census(): Promise<{ parts: Parts; slide: string }> {
  const fs = process.getBuiltinModule("node:fs")
  const parts = await readParts(
    new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/census-updating-spm.pptx`)),
  )
  const slide = readSlides(parts).find((each) => each.part === part)?.slide
  if (slide === undefined) throw new Error("slide")
  return { parts, slide }
}

function landed(parts: Parts, rows: readonly (readonly [ElementId, ElementPatch])[]): Register {
  const index = indexPackage(parts)
  const opened: Register = {
    ...openRegister("", "clean"),
    index: { ...index, total: index.elements.length, pages: [] },
  }
  const commands: Command[] = []
  for (const [node, patch] of rows) {
    if (!commands.some((each) => each.command === "add" && each.node === node))
      commands.push({ command: "add", node, floor: "", route: "clean" })
    commands.push({ command: "person", node, v: format, patch })
  }
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, opened)
}

function xfrmOf(parts: Parts, id: string): string {
  const text = decodeUtf8(parts.get(part)!)
  const at = text.indexOf(`<p:cNvPr id="${id}"`)
  const start = text.indexOf("<a:xfrm", at)
  return text.slice(start, text.indexOf("</a:xfrm>", start) + 9)
}

function placeOf(parts: Parts, id: string) {
  const xfrm = xfrmOf(parts, id)
  const number = (name: string) => Number(new RegExp(`${name}="(-?\\d+)"`).exec(xfrm)?.[1])
  return {
    box: { x: number(" x"), y: number(" y"), cx: number("cx"), cy: number("cy") },
    rot: number("rot") || 0,
    flipH: xfrm.includes('flipH="1"'),
    flipV: xfrm.includes('flipV="1"'),
  }
}

const rect = outlineOf(null, {})!

describe("a connector bound to two shapes on export", () => {
  it("keeps the slide byte for byte when an unbound element changes and the bound shapes do not", async () => {
    const { parts, slide } = await census()
    const graphic = elementId(`${slide}.23`)
    const exported = exportParts(parts, landed(parts, [[graphic, { box: { y: { set: 20000 } } }]]))
    expect(xfrmOf(exported, "23")).not.toBe(xfrmOf(parts, "23"))
    expect(xfrmOf(exported, "26")).toBe(xfrmOf(parts, "26"))
    expect(xfrmOf(exported, "26")).toBe(
      '<a:xfrm flipH="1"><a:off x="4405637" y="3957097"/><a:ext cx="400400" cy="771566"/></a:xfrm>',
    )
  })

  it("follows the rectangle it ends on, keeps its line preset, and comes back byte for byte when the move is undone", async () => {
    const { parts, slide } = await census()
    const card = elementId(`${slide}.15`)
    const exported = exportParts(parts, landed(parts, [[card, { box: { x: { set: 3948437 + 254000 } } }]]))
    expect(xfrmOf(exported, "26")).toBe(
      '<a:xfrm flipH="1"><a:off x="4659637" y="3957097"/><a:ext cx="146400" cy="771566"/></a:xfrm>',
    )
    expect(decodeUtf8(exported.get(part)!)).toContain('<a:prstGeom prst="line"><a:avLst/></a:prstGeom>')
    const ends = connectorEnds(placeOf(exported, "26"))
    expect(ends.end).toEqual(sitePoint(placeOf(exported, "15"), rect, 0))
    expect(ends.start).toEqual(sitePoint(placeOf(exported, "6"), rect, 2))
    const back = exportParts(parts, landed(parts, [[card, { box: { x: { set: 3948437 } } }]]))
    expect(decodeUtf8(back.get(part)!)).toBe(decodeUtf8(parts.get(part)!))
  })

  it("rebinds an end to another site and routes to it", async () => {
    const { parts, slide } = await census()
    const line = elementId(`${slide}.26`)
    const card = elementId(`${slide}.15`)
    const exported = exportParts(
      parts,
      landed(parts, [[line, { connection: { end: { set: { shape: { node: card, site: 3 } } } } }]]),
    )
    expect(shownConnection(exported, { slide, part, shape: "26" })?.end).toEqual({ shape: { node: card, site: 3 } })
    expect(decodeUtf8(exported.get(part)!)).toContain('<a:stCxn id="6" idx="2"/><a:endCxn id="15" idx="3"/>')
    expect(connectorEnds(placeOf(exported, "26")).end).toEqual(sitePoint(placeOf(exported, "15"), rect, 3))
  })

  it("drops a binding with none and then leaves the line where it is", async () => {
    const { parts, slide } = await census()
    const line = elementId(`${slide}.26`)
    const card = elementId(`${slide}.15`)
    const exported = exportParts(
      parts,
      landed(parts, [
        [line, { connection: { start: { set: { none: true } }, end: { set: { none: true } } } }],
        [card, { box: { x: { set: 3948437 + 254000 } } }],
      ]),
    )
    expect(decodeUtf8(exported.get(part)!)).toContain("<p:cNvCxnSpPr><a:cxnSpLocks/></p:cNvCxnSpPr>")
    expect(xfrmOf(exported, "26")).toBe(xfrmOf(parts, "26"))
  })

  it("routes nothing on a slide whose bytes did not change", async () => {
    const { parts } = await census()
    expect(routedParts(parts, parts)).toBe(parts)
  })
})

function elbowed(parts: Parts, adjust: string): Parts {
  const text = decodeUtf8(parts.get(part)!)
  const line = '<a:prstGeom prst="line"><a:avLst/></a:prstGeom>'
  if (!text.includes(line)) throw new Error("line")
  const next = new Map(parts)
  next.set(
    part,
    encodeUtf8(text.replace(line, `<a:prstGeom prst="bentConnector3"><a:avLst>${adjust}</a:avLst></a:prstGeom>`)),
  )
  return next
}

function geometryOf(parts: Parts): string {
  const text = decodeUtf8(parts.get(part)!)
  return /<a:prstGeom prst="bentConnector3">.*?<\/a:prstGeom>/.exec(text)?.[0] ?? ""
}

describe("an elbow connector bound to two shapes on export", () => {
  it("turns a quarter, drops the file's flip and puts its bend midway when the rectangle it ends on moves", async () => {
    const census_ = await census()
    const parts = elbowed(census_.parts, '<a:gd name="adj1" fmla="val 20000"/>')
    const card = elementId(`${census_.slide}.15`)
    const exported = exportParts(parts, landed(parts, [[card, { box: { x: { set: 3948437 + 254000 } } }]]))
    expect(xfrmOf(exported, "26")).toBe(
      '<a:xfrm flipH="0" rot="5400000"><a:off x="4347054" y="4269680"/><a:ext cx="771566" cy="146400"/></a:xfrm>',
    )
    expect(geometryOf(exported)).toBe(
      '<a:prstGeom prst="bentConnector3"><a:avLst><a:gd name="adj1" fmla="val 50000"/></a:avLst></a:prstGeom>',
    )
    const back = exportParts(parts, landed(parts, [[card, { box: { x: { set: 3948437 } } }]]))
    expect(decodeUtf8(back.get(part)!)).toBe(decodeUtf8(parts.get(part)!))
  })

  it("keeps the file's adjust bytes when the route puts the bend where the file has it", async () => {
    const census_ = await census()
    const parts = elbowed(census_.parts, "")
    const card = elementId(`${census_.slide}.15`)
    const exported = exportParts(parts, landed(parts, [[card, { box: { x: { set: 3948437 + 254000 } } }]]))
    expect(geometryOf(exported)).toBe('<a:prstGeom prst="bentConnector3"><a:avLst></a:avLst></a:prstGeom>')
  })

  it("turns past the rectangle when both ends attach to bottom sites", async () => {
    const census_ = await census()
    const parts = elbowed(census_.parts, "")
    const line = elementId(`${census_.slide}.26`)
    const card = elementId(`${census_.slide}.15`)
    const exported = exportParts(
      parts,
      landed(parts, [[line, { connection: { end: { set: { shape: { node: card, site: 2 } } } } }]]),
    )
    const w = 4728663 + 914400 - 3957097
    expect(geometryOf(exported)).toBe(
      `<a:prstGeom prst="bentConnector3"><a:avLst><a:gd name="adj1" fmla="val ${String(Math.round(((w + elbowClearance) * 100000) / w))}"/></a:avLst></a:prstGeom>`,
    )
    expect(connectorEnds(placeOf(exported, "26")).end).toEqual(sitePoint(placeOf(exported, "15"), rect, 2))
  })
})

async function connectorDeck(): Promise<{ parts: Parts; slide: string }> {
  const fs = process.getBuiltinModule("node:fs")
  const parts = await readParts(
    new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/connectors.pptx`)),
  )
  const slide = readSlides(parts)[0]?.slide
  if (slide === undefined) throw new Error("slide")
  return { parts, slide }
}

const deckPart = "ppt/slides/slide1.xml"

function deckPlace(parts: Parts, id: string) {
  const text = decodeUtf8(parts.get(deckPart)!)
  const at = text.indexOf(`<p:cNvPr id="${id}"`)
  const xfrm = text.slice(text.indexOf("<a:xfrm", at), text.indexOf("</a:xfrm>", at))
  const number = (name: string) => Number(new RegExp(`${name}="(-?\\d+)"`).exec(xfrm)?.[1] ?? 0)
  return {
    box: { x: number(" x"), y: number(" y"), cx: number("cx"), cy: number("cy") },
    rot: number("rot"),
    flipH: xfrm.includes('flipH="1"'),
    flipV: xfrm.includes('flipV="1"'),
  }
}

function deckAdjust(parts: Parts, id: string): number {
  const text = decodeUtf8(parts.get(deckPart)!)
  const at = text.indexOf(`<p:cNvPr id="${id}"`)
  return Number(/name="adj1" fmla="val (-?\d+)"/.exec(text.slice(at))?.[1])
}

describe("the connector deck's two elbows", () => {
  const rounded = outlineOf("roundRect", {})!

  it("sit where the route puts them, so a reroute with nothing moved writes the file's own bytes", async () => {
    const { parts } = await connectorDeck()
    const plan = deckPlace(parts, "2")
    const build = deckPlace(parts, "3")
    for (const [id, start, end] of [
      ["4", siteTie(plan, rounded, 3), siteTie(build, rounded, 1)],
      ["5", siteTie(plan, rounded, 2), siteTie(build, rounded, 2)],
    ] as const) {
      const place = deckPlace(parts, id)
      expect(routed(place, "bentConnector3", { adj1: deckAdjust(parts, id) }, start, end)).toEqual({
        place,
        preset: "bentConnector3",
        adjust: { adj1: deckAdjust(parts, id) },
      })
    }
  })

  it("go around in five segments once Build moves behind Plan, and the export names that elbow", async () => {
    const { parts, slide } = await connectorDeck()
    const build = elementId(`${slide}.3`)
    const behind = { x: { set: 0 }, y: { set: 4_572_000 } }
    const exported = exportParts(parts, landed(parts, [[build, { box: behind }]]))
    const xml = decodeUtf8(exported.get(deckPart) ?? new Uint8Array())
    const between = xml.slice(xml.indexOf('<p:cNvPr id="4"'), xml.indexOf("</p:cxnSp>", xml.indexOf('<p:cNvPr id="4"')))
    expect(between).toContain('<a:prstGeom prst="bentConnector5">')
    const moved = deckPlace(exported, "3")
    const plan = deckPlace(exported, "2")
    expect(connectorEnds(deckPlace(exported, "4"))).toEqual({
      start: siteTie(plan, rounded, 3)?.spot,
      end: siteTie(moved, rounded, 1)?.spot,
    })
  })

  it("follow Build down: the bend between the two stays midway and the bend under both moves with the drop", async () => {
    const { parts, slide } = await connectorDeck()
    const build = elementId(`${slide}.3`)
    const exported = exportParts(parts, landed(parts, [[build, { box: { y: { set: 3_810_000 + 762_000 } } }]]))
    expect(deckAdjust(exported, "4")).toBe(50_000)
    const w = 1_524_000 + 762_000
    expect(deckAdjust(exported, "5")).toBe(Math.round(((w + elbowClearance) * 100_000) / w))
    const moved = deckPlace(exported, "3")
    expect(connectorEnds(deckPlace(exported, "4")).end).toEqual(siteTie(moved, rounded, 1)?.spot)
    expect(connectorEnds(deckPlace(exported, "5")).end).toEqual(siteTie(moved, rounded, 2)?.spot)
  })
})

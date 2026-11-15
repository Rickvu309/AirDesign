import {
  connectorEnds,
  decide,
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
import { boundTargets, routedParts } from "./connector-route.js"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
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
    rot: 0,
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

  it("names the shapes a connector binds, so a move of one repaints its connector", async () => {
    const { parts, slide } = await census()
    const bound = boundTargets(parts)
    expect(bound.has(`${slide}.6`) && bound.has(`${slide}.15`)).toBe(true)
    expect(bound.has(`${slide}.23`)).toBe(false)
    expect(bound.size).toBe(8)
  })

  it("routes nothing on a slide whose bytes did not change", async () => {
    const { parts } = await census()
    expect(routedParts(parts, parts)).toBe(parts)
  })
})

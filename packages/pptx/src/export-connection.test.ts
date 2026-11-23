import { routed, siteTie, outlineOf } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { routedParts } from "./connector-route.js"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readSlides } from "./read-shapes.js"

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

describe("a connector bound to two shapes on export", () => {
  it("routes nothing on a slide whose bytes did not change", async () => {
    const { parts } = await census()
    expect(routedParts(parts, parts)).toBe(parts)
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
})

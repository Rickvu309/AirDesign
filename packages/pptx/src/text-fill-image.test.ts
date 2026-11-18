import { expect, it } from "vitest"
import { writeTextValue, type TextValue } from "@airdesign/document"
import { decodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { paintReader } from "./paint-reader.js"
import { shownTextStyle } from "./text-style-read.js"
import { textXml } from "./trait-xml-text.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const fs = process.getBuiltinModule("node:fs")
const fixture = (name: string) => new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
const sha256 = "ab".repeat(32)
const photo = fixture("picture.png")
const at = { slide: "256", part: "ppt/slides/slide1.xml", shape: "2", media: () => photo }
const filled: TextValue = [{ from: 0, runs: [{ from: 0, text: "Hello!", fill: { image: `image/png:${sha256}` } }] }]

function written(parts: ReadonlyMap<string, Uint8Array>, value: TextValue) {
  const field = textXml.fields.value
  if (field.at !== "whole") throw new Error("text")
  return field.codec.write(parts, at, writeTextValue(value))
}

it("writes a picture fill on a run as PowerPoint's own a:blipFill, linked to the picture", async () => {
  const parts = await readParts(fixture("text.pptx"))
  const next = written(parts, filled)
  const xml = decodeUtf8(next.get(at.part)!)
  const run = /<a:rPr lang="en-US" sz="3200">(.*?)<\/a:rPr>/.exec(xml)?.[1]
  expect(run).toMatch(
    /^<a:blipFill rotWithShape="1"><a:blip r:embed="(rId\d+)"\/><a:stretch><a:fillRect\/><\/a:stretch><\/a:blipFill>$/,
  )
  const id = /r:embed="(rId\d+)"/.exec(run ?? "")?.[1]
  const rels = decodeUtf8(next.get("ppt/slides/_rels/slide1.xml.rels")!)
  const target = new RegExp(`Id="${id}"[^>]*Target="\\.\\./(media/[^"]+)"`).exec(rels)?.[1]
  expect(next.get(`ppt/${target}`)).toEqual(photo)
  const style = shownTextStyle(next, { part: at.part, shape: at.shape })
  expect(style?.fill).toEqual({ value: { image: null }, own: true })
  const painted = paintReader(next)
    .slide(at.part)
    .elements.find((element) => element.shape === "2")
  expect(painted?.text?.paragraphs[0]?.runs[0]?.picture?.part).toBe(`ppt/${target}`)
})

it("keeps an untouched picture fill on a run byte for byte when other words change", async () => {
  const parts = await readParts(fixture("text.pptx"))
  const once = written(parts, filled)
  const field = textXml.fields.value
  if (field.at !== "whole") throw new Error("text")
  const kept = field.codec.read(once, at)
  expect(kept).not.toBeNull()
  expect(written(once, JSON.parse(kept!)).get(at.part)).toEqual(once.get(at.part))
})

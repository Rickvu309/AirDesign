import { expect, it } from "vitest"
import { writeTextValue, type TextValue } from "@airdesign/document"
import { readParts } from "./package-container.js"
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

it("keeps an untouched picture fill on a run byte for byte when other words change", async () => {
  const parts = await readParts(fixture("text.pptx"))
  const once = written(parts, filled)
  const field = textXml.fields.value
  if (field.at !== "whole") throw new Error("text")
  const kept = field.codec.read(once, at)
  expect(kept).not.toBeNull()
  expect(written(once, JSON.parse(kept!)).get(at.part)).toEqual(once.get(at.part))
})

import {
  decide,
  format,
  openRegister,
  templateStylesNode,
  type Command,
  type Register,
  type TraitPatch,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { decodeUtf8, sameBytes } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { paintReader } from "./paint-reader.js"
import { readSlides } from "./read-shapes.js"
import { shownTheme } from "./trait-xml-theme.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const used = ["ppt/theme/theme1.xml", "ppt/theme/theme2.xml"]

async function deck(): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/doe-heat-pumps.pptx`)))
}

function styled(...patches: readonly TraitPatch<"templateStyle">[]): Register {
  const commands: Command[] = [
    { command: "add", node: templateStylesNode, floor: "", route: "doe" },
    ...patches.map((templateStyle): Command => ({
      command: "person",
      node: templateStylesNode,
      v: format,
      patch: { templateStyle },
    })),
  ]
  return commands.reduce(
    (current, command) => {
      const decision = decide(current, command)
      if (decision.decision === "refuse") throw new Error(decision.code)
      return decision.register
    },
    openRegister("", "doe"),
  )
}

function text(parts: Parts, part: string): string {
  const bytes = parts.get(part)
  if (bytes === undefined) throw new Error(part)
  return decodeUtf8(bytes)
}

function changedParts(before: Parts, after: Parts): readonly string[] {
  return [...after.keys()].filter((name) => {
    const old = before.get(name)
    const now = after.get(name)
    return old === undefined || now === undefined || !sameBytes(old, now)
  })
}

function painted(parts: Parts): string {
  const reader = paintReader(parts)
  return JSON.stringify(readSlides(parts).map(({ part }) => reader.slide(part).elements))
}

describe("a change to every template style", () => {
  it("writes an edited colour and Latin font into every theme a slide uses, keeps each theme's East Asian, complex script and script fonts, and leaves every other part alone", async () => {
    const parts = await deck()
    const exported = exportParts(parts, styled({ accent1: { set: "C00000" }, major: { set: "Georgia" } }))
    expect(changedParts(parts, exported)).toEqual(used)
    for (const part of used) {
      const before = text(parts, part)
      const after = text(exported, part)
      expect(after).toContain('<a:accent1><a:srgbClr val="C00000"/></a:accent1>')
      expect(after).toContain(
        '<a:majorFont><a:latin typeface="Georgia" panose="020F0302020204030204"/><a:ea typeface=""/><a:cs typeface=""/>',
      )
      expect(after).toContain('<a:font script="Jpan" typeface="游ゴシック Light"/>')
      expect(after.replace('val="C00000"', 'val="4472C4"')).toBe(
        before.replace(
          '<a:latin typeface="Calibri Light" panose="020F0302020204030204"/>',
          '<a:latin typeface="Georgia" panose="020F0302020204030204"/>',
        ),
      )
    }
    expect(text(exported, "ppt/theme/theme3.xml")).toBe(text(parts, "ppt/theme/theme3.xml"))
    expect(shownTheme(exported, "ppt/slides/slide1.xml")).toMatchObject({ accent1: "C00000", major: "Georgia" })
  })

  it("puts a hex colour where the file named a system colour, and escapes a font's name", async () => {
    const parts = await deck()
    const exported = exportParts(parts, styled({ lt1: { set: "FFF2CC" }, minor: { set: 'Fira "Sans" & Co' } }))
    const after = text(exported, "ppt/theme/theme1.xml")
    expect(after).toContain('<a:lt1><a:srgbClr val="FFF2CC"/></a:lt1>')
    expect(after).toContain(
      '<a:minorFont><a:latin typeface="Fira &quot;Sans&quot; &amp; Co" panose="020F0502020204030204"/>',
    )
    expect(shownTheme(exported, "ppt/slides/slide1.xml")).toMatchObject({ lt1: "FFF2CC", minor: 'Fira "Sans" & Co' })
  })

  it("writes nothing for a value the theme already shows, or for a field back to its opening", async () => {
    const parts = await deck()
    const same = styled({ dk1: { set: "000000" }, accent1: { set: "4472C4" }, minor: { set: "Calibri" } })
    expect(changedParts(parts, exportParts(parts, same))).toEqual([])
    const undone = styled({ accent1: { set: "C00000" } }, { accent1: "opening" })
    expect(changedParts(parts, exportParts(parts, undone))).toEqual([])
  })

  it("exports the same bytes twice over", async () => {
    const parts = await deck()
    const register = styled({ accent2: { set: "00B050" }, major: { set: "Georgia" } })
    const once = exportParts(parts, register)
    expect(changedParts(once, exportParts(once, register))).toEqual([])
  })

  it("paints every element that names the slot or the heading font from the exported theme", async () => {
    const parts = await deck()
    const before = painted(parts)
    const after = painted(exportParts(parts, styled({ accent1: { set: "C00000" }, major: { set: "Georgia" } })))
    expect(before).not.toContain('"C00000"')
    expect(after).toContain('"C00000"')
    expect(before).not.toContain('"Georgia"')
    expect(after).toContain('"Georgia"')
  })
})

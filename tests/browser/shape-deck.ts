import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly ZipWriter: new (writer: unknown) => {
    add(name: string, reader: unknown): Promise<unknown>
    close(): Promise<Uint8Array>
  }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

export async function shapeDeck(custom = false): Promise<Buffer> {
  const reader = new zip.ZipReader(
    new zip.Uint8ArrayReader(new Uint8Array(await readFile(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")))),
  )
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue
    let bytes = await entry.getData(new zip.Uint8ArrayWriter())
    if (entry.filename === "ppt/slides/slide1.xml") {
      let sheet = Buffer.from(bytes)
        .toString("utf8")
        .replace('prst="rect"', 'prst="rightArrow"')
        .replace("<a:avLst/>", '<a:avLst><a:gd name="adj2" fmla="val 75000"/></a:avLst>')
        .replace('<a:schemeClr val="accent1"/>', '<a:srgbClr val="FF0000"/>')
      if (custom)
        sheet = sheet.replace(
          /<a:prstGeom[\s\S]*?<\/a:prstGeom>/,
          '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="200" h="100"><a:moveTo><a:pt x="0" y="100"/></a:moveTo><a:lnTo><a:pt x="100" y="0"/></a:lnTo><a:lnTo><a:pt x="200" y="100"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>',
        )
      const ends = [
        ["arrow", "triangle"],
        ["stealth", "diamond"],
        ["oval", "arrow"],
      ]
      const connectors = ends
        .map(
          ([head, tail], index) =>
            `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${3 + index}" name="Connector ${index}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="457200" y="${3200400 + index * 457200}"/><a:ext cx="5486400" cy="0"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="38100"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:prstDash val="dash"/><a:headEnd type="${head}"/><a:tailEnd type="${tail}"/></a:ln></p:spPr></p:cxnSp>`,
        )
        .join("")
      const callout =
        '<p:sp><p:nvSpPr><p:cNvPr id="6" name="Callout"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="6858000" y="457200"/><a:ext cx="1828800" cy="1828800"/></a:xfrm><a:prstGeom prst="wedgeRectCallout"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr></p:sp>'
      sheet = sheet.replace("</p:spTree>", `${connectors}${callout}</p:spTree>`)
      bytes = Buffer.from(sheet, "utf8")
    }
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  return Buffer.from(await writer.close())
}

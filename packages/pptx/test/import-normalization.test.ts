import { it, expect } from "vitest"
import { readFile } from "node:fs/promises"
import { importPptx, exportPptx } from "../src/index.ts"
import { writeArchive } from "../src/archive.ts"
import { parseXml } from "../src/xml.ts"
import { rejectActiveSvg, fileLimits } from "../../files/src/index.ts"

const pi = '<?mso-contentType?><FormTemplates xmlns="http://schemas.microsoft.com/sharepoint/v3/contenttype/forms"><Display>DocumentLibraryForm</Display></FormTemplates>'
const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" id="Icons_Camera" overflow="hidden"><path d="M0 0L96 96" fill="#00B050"/></svg>'
const base = await importPptx(await readFile(new URL("../../../fixtures/pptx/native.pptx", import.meta.url)))
async function withPart(part: string, xml: string) {
  const parts = new Map(base.parts)
  parts.set(part, Buffer.from(xml))
  return importPptx(await writeArchive(parts))
}
it("normalizes only the qualified Office PI and records persistent removals", async () => {
  expect(() => parseXml(Buffer.from(pi))).toThrow("processing-instruction")
  const safe = await withPart("customXml/item3.xml", pi)
  expect(safe.parts.get("customXml/item3.xml")?.toString()).not.toContain("<?mso")
  expect(safe.report.removals).toContainEqual(expect.objectContaining({ part: "customXml/item3.xml", reason: "inert-office-processing-instruction" }))
  const again = await importPptx(await exportPptx(safe))
  expect(again.report.removals).toEqual(safe.report.removals)
})
it("keeps sanitized icon geometry and records exact root attribute removals", async () => {
  expect(() => rejectActiveSvg(icon)).toThrow("unsafe-svg")
  const safe = await withPart("ppt/media/camera.svg", icon)
  expect(safe.parts.get("ppt/media/camera.svg")?.toString()).toContain('<path d="M0 0L96 96"')
  expect(safe.report.removals).toContainEqual(expect.objectContaining({ reason: "inert-svg-attributes" }))
  expect((await importPptx(await exportPptx(safe))).report.removals).toEqual(safe.report.removals)
})
it.each([
  '<script>alert(1)</script>', '<g onclick="alert(1)"/>', '<foreignObject/>', '<image href="https://evil.test/a"/>', '<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="file:///etc/passwd"/>', '<path fill="url(https://evil.test)"/>', '<?evil command?>', '<g id="nested-id"/>', '<g style="background:url(https://evil.test)"/>'
])("refuses active or unqualified SVG despite removable root attributes: %s", async payload => {
  await expect(withPart("ppt/media/camera.svg", icon.replace("</svg>", payload + "</svg>"))).rejects.toThrow()
})
it.each([
  pi.replace("<?mso-contentType?>", '<?mso-contentType target="https://evil.test"?>'), pi.replace("<?mso-contentType?>", "<?unknown?>"), pi.replace("FormTemplates", "Other"), '<?mso-contentType?><!DOCTYPE x [<!ENTITY a "expand">]><x>&a;</x>', '<?mso-contentType?><!DOCTYPE x SYSTEM "https://evil.test/a"><x/>', pi + "<?evil?>", "<x>".repeat(130) + "</x>".repeat(130)
])("refuses unqualified PI, DTD, entity and depth attacks: %s", async xml => {
  await expect(withPart("customXml/item3.xml", xml)).rejects.toThrow()
})
it("does not normalize PI outside the qualified part or accept unsafe limits", async () => {
  await expect(withPart("ppt/slides/slide999.xml", pi)).rejects.toThrow()
  await expect(withPart("customXml/item3.xml", "<x/>".repeat(fileLimits.nodes + 1))).rejects.toThrow()
  await expect(withPart("ppt/media/camera.svg", icon.replace("</svg>", "<g>".repeat(130) + "</g>".repeat(130) + "</svg>"))).rejects.toThrow()
  await expect(writeArchive(new Map([["../bad", Buffer.from("bad")]]))).rejects.toThrow()
  await expect(withPart("customXml/item3.xml", " ".repeat(fileLimits.xml + 1))).rejects.toThrow()
})
it("keeps declared relationship removal distinct from preserved icon content", async () => {
  const parts = new Map(base.parts)
  const part = "ppt/slides/slide1.xml", rel = "ppt/slides/_rels/slide1.xml.rels"
  const xml = parts.get(part)!.toString()
  parts.set(part, Buffer.from(xml.replace("</p:spTree>", '<p:pic><p:nvPicPr><p:cNvPr id="998" name="Remote image"/></p:nvPicPr><p:blipFill><a:blip r:link="remoteImage"/></p:blipFill></p:pic></p:spTree>')))
  parts.set(rel, Buffer.from(parts.get(rel)!.toString().replace("</Relationships>", '<Relationship Id="remoteImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://evil.test/a.png" TargetMode="External"/></Relationships>')))
  const safe = await importPptx(await writeArchive(parts))
  expect(safe.report.removals).toContainEqual(expect.objectContaining({ disposition: "removed", affectedObjects: [{ part, objectId: "998", content: "removed" }] }))
  const { importedDeck } = await import("../src/import-deck.ts")
  expect(importedDeck(safe).slides[0]!.elements.some(element => element.support.kind === "flagged" && element.support.preservation === "removed")).toBe(true)
})
it("refuses real archive ratio, part count, byte and XML node limits", async () => {
  const { ZipFile } = await import("yazl")
  const { readArchive } = await import("../src/archive.ts")
  const zip = new ZipFile(), chunks: Buffer[] = []
  const compressed = new Promise<Buffer>((resolve, reject) => { zip.outputStream.on("data", chunk => chunks.push(chunk)); zip.outputStream.on("end", () => resolve(Buffer.concat(chunks))); zip.outputStream.on("error", reject) })
  zip.addBuffer(Buffer.alloc(1024 * 1024, 65), "ratio.bin", { compress: true }); zip.end()
  await expect(readArchive(await compressed)).rejects.toThrow("expansion")
  await expect(readArchive(await writeArchive(new Map(Array.from({ length: fileLimits.parts + 1 }, (_, index) => [`part${index}`, Buffer.from("a")]))))).rejects.toThrow("part-limit")
  await expect(readArchive(Buffer.alloc(fileLimits.compressed + 1))).rejects.toThrow("input-limit")
  expect(() => parseXml(Buffer.from("<x>" + "<n/>".repeat(fileLimits.nodes) + "</x>"))).toThrow("complexity")
})

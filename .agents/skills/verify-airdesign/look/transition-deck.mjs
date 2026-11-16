import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { expect } from "@playwright/test"

export async function transitionDeck(kit) {
  const zip = createRequire(path.join(kit.repo, "packages/pptx/package.json"))("@zip.js/zip.js")
  const original = await readFile(path.join(kit.repo, "scripts/pptx-fixtures/nasa-1d-cnn.pptx"))
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(original))
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue
    let bytes = await entry.getData(new zip.Uint8ArrayWriter())
    let xml = Buffer.from(bytes).toString("utf8")
    if (entry.filename === "ppt/slides/slide3.xml") {
      xml = xml.replace(/<p:sld\b/, '<p:sld show="0"')
      bytes = new TextEncoder().encode(xml)
    }
    if (entry.filename === "ppt/slides/slide4.xml") {
      xml = xml.replace("</p:sld>", '<p:transition spd="slow"><p:push dir="u"/></p:transition></p:sld>')
      bytes = new TextEncoder().encode(xml)
    }
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  await kit.signIn()
  await kit.page.goto("/")
  await kit.page.locator("input[type=file]").setInputFiles({
    name: "show.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: Buffer.from(await writer.close()),
  })
  await expect(kit.page.locator(".thin-page[data-deck-ready]")).toBeVisible()
  await kit.page.locator('[data-slide-entry="2"]').click()
  await kit.page.getByRole("button", { name: "Present", exact: true }).click()
  await expect(kit.page.locator("[data-present-slide]")).toHaveAttribute("data-present-slide", "2")
  await kit.page.keyboard.press("ArrowRight")
  await expect(kit.page.locator("[data-present-slide]")).not.toHaveAttribute("data-present-slide", "2")
}

import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }
type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

test("Aira adds a text box with text, a reload keeps it, the export keeps it, and Undo takes it away", async ({
  page,
  context,
  stack,
}, testInfo) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/blank.pptx"))
  await expect(page).toHaveURL(/\/deck\//)
  const deck = page.url().split("/").at(-1) ?? ""
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(2)
  const base = Number((await stack.post("/decks/open", { deck }, cookie)).json.revision)
  stack.aira({ name: "add-text-box.sse", fill: { deck, base: String(base) } }, { name: "edited.sse" })
  await page.getByRole("textbox", { name: "Ask Aira" }).fill("Add a text box that says Hello from Aira")
  await page.keyboard.press("Enter")
  await expect(texts).toHaveCount(3)
  await expect(texts.last()).toHaveText("Hello from Aira")
  await page.reload()
  await expect(texts).toHaveCount(3)
  await expect(texts.last()).toHaveText("Hello from Aira")
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const file = testInfo.outputPath("aira-text-box.pptx")
  await (await saving).saveAs(file)
  expect(await slideXml(file)).toContain("<a:t>Hello from Aira</a:t>")
  await page.locator("[data-editor-panel]").getByRole("button", { name: productCopy.undo }).click()
  await expect(texts).toHaveCount(2)
  await page.reload()
  await expect(texts).toHaveCount(2)
})

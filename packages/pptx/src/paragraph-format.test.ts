import { expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paragraphBytes } from "./paragraph-format.js"

const namespace = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'

function written(properties: string | null): string {
  const xml = properties ?? `<a:p ${namespace}/>`
  const bytes = encodeUtf8(xml)
  const found = properties === null ? undefined : markupDocument(bytes).elements[0]
  const out = paragraphBytes(bytes, found, { from: 0, align: "justify", runs: [] })
  return out === null ? "" : decodeUtf8(out)
}

it("writes a justified paragraph as PowerPoint's algn just, new or over another alignment", () => {
  expect(written(null)).toContain('algn="just"')
  expect(written(`<a:pPr ${namespace} algn="r"/>`)).toContain('algn="just"')
  expect(written(`<a:pPr ${namespace} algn="r"/>`)).not.toContain('algn="r"')
})

it("writes a new bullet's hang from its text size, the marker just under an em before the text", () => {
  const out = paragraphBytes(encodeUtf8(`<a:p ${namespace}/>`), undefined, {
    from: 0,
    list: "bullets",
    runs: [{ from: -1, text: "Point", size: 1200 }],
  })
  expect(out === null ? "" : decodeUtf8(out)).toContain('marL="137160"')
  expect(out === null ? "" : decodeUtf8(out)).toContain('indent="-137160"')
})

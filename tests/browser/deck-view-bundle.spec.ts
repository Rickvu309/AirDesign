import { readFile } from "node:fs/promises"
import { gzipSync } from "node:zlib"
import { expect, test } from "./deck-test"

const entryGzipLimit = 262_000

test("the deck view's entry stays within its gzip budget and leaves text shaping for later", async () => {
  const page = await readFile("apps/web/dist/deck-view.html", "utf8")
  const scripts = [...page.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].flatMap(([, file]) =>
    file === undefined ? [] : [file],
  )
  expect(scripts.length).toBeGreaterThan(0)
  expect(scripts.some((file) => /\/layout-[\w-]{8}\.js$/.test(file))).toBe(false)
  const sizes = await Promise.all(
    scripts.map(async (file) => gzipSync(await readFile(`apps/web/dist/${file}`), { level: 9 }).length),
  )
  const total = sizes.reduce((sum, size) => sum + size, 0)
  console.log(`deck view entry: ${String(total)} bytes gzip in ${String(scripts.length)} files`)
  expect(total).toBeLessThanOrEqual(entryGzipLimit)
})

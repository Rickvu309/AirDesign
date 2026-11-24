import { readFile } from "node:fs/promises"
import { expect, test } from "vitest"
import { fontRevision, loadFontLayout, servedFontName } from "./index.js"

const narrow = new URL("../../../apps/api/fonts/LiberationSansNarrow-Regular.ttf", import.meta.url)

test("shapes loaded faces with UTF-16 clusters and reports missing clusters", async () => {
  const layout = await loadFontLayout()
  const face = await layout.prepareFace({
    revision: fontRevision,
    key: "narrow",
    axes: {},
    read: () => readFile(narrow),
  })
  const shape = (text: string, tracking: number) => {
    const range = { start: 0, end: text.length }
    return layout.shapeLine({
      paragraph: {
        text,
        locale: "en-US",
        direction: "ltr",
        runs: [{ range, faces: [face], size: 44, tracking }],
        sourceOffsetByTextOffset: Array.from({ length: text.length + 1 }, (_, at) => at),
      },
      range,
      lineEnding: "plain",
    })
  }
  const plain = shape("AV", 0)
  const tracked = shape("AV", 0.25)
  expect(plain).toMatchObject({ kind: "shaped", glyphs: [{ cluster: 0 }, { cluster: 1 }] })
  expect(plain.kind === "shaped" && tracked.kind === "shaped" && tracked.advance - plain.advance).toBe(0.5)
  expect(shape("A🫠", 0)).toEqual({ kind: "unserved", range: { start: 1, end: 3 } })
})

test("aliases and concurrent prepares share the same file across variation requests", async () => {
  const layout = await loadFontLayout()
  const alias = servedFontName("Arial Narrow")
  expect(alias).toBe(servedFontName("Liberation Sans Narrow"))
  if (alias === undefined) throw new Error("Missing served font alias")
  let reads = 0
  const read = () => {
    reads++
    return readFile(narrow)
  }
  const asset = { revision: fontRevision, key: alias, read }
  const [one, two] = await Promise.all([
    layout.prepareFace({ ...asset, axes: { wght: 400 } }),
    layout.prepareFace({ ...asset, axes: { wght: 700 } }),
  ])
  expect(reads).toBe(1)
  expect(one.sha256).toBe(two.sha256)
  expect(layout.cache()).toMatchObject({ faces: 1, evictions: 0 })
})

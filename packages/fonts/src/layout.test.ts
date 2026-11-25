import { readFile } from "node:fs/promises"
import { expect, test, vi } from "vitest"
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
  const third = await layout.prepareFace({ ...asset, key: "distinct-key-for-narrow", axes: {} })
  expect(reads).toBe(2)
  expect(third.sha256).toBe(one.sha256)
  expect(layout.cache().faces).toBe(1)
})

test("shapes across adjacent run boundaries with separately prepared faces", async () => {
  const layout = await loadFontLayout()
  const asset = { revision: fontRevision, key: "narrow", axes: {}, read: () => readFile(narrow) }
  const first = await layout.prepareFace(asset)
  const second = await layout.prepareFace(asset)
  const text = "AVATAR office"
  const range = { start: 0, end: text.length }
  const style = { size: 44, tracking: 0 }
  const shape = (runs: Parameters<typeof layout.shapeLine>[0]["paragraph"]["runs"]) =>
    layout.shapeLine({
      paragraph: {
        text,
        locale: "en-US",
        direction: "ltr",
        runs,
        sourceOffsetByTextOffset: Array.from({ length: text.length + 1 }, (_, at) => at),
      },
      range,
      lineEnding: "plain",
    })
  const whole = shape([{ ...style, range, faces: [first] }])
  expect(whole.kind).toBe("shaped")
  expect(
    shape([
      { ...style, range: { start: 0, end: 1 }, faces: [first] },
      { ...style, range: { start: 1, end: text.length }, faces: [second] },
    ]),
  ).toEqual(whole)
})

test("reads a second face while the first face is still loading", async () => {
  const layout = await loadFontLayout()
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const slow = layout.prepareFace({
    revision: fontRevision,
    key: "slow-narrow",
    axes: {},
    read: async () => {
      await held
      return readFile(narrow)
    },
  })
  const read = vi.fn(() => readFile(narrow))
  const fast = layout.prepareFace({ revision: fontRevision, key: "fast-narrow", axes: {}, read })
  await Promise.resolve()
  try {
    expect(read).toHaveBeenCalledOnce()
  } finally {
    release()
    await Promise.all([slow, fast])
  }
})

test("bounds repeated reads of an unavailable face revision", async () => {
  const layout = await loadFontLayout()
  const read = vi.fn(async () => {
    throw new Error("unavailable")
  })
  const asset = { revision: "unavailable-revision", key: "narrow", axes: {}, read }
  for (let attempt = 0; attempt < 5; attempt++) await expect(layout.prepareFace(asset)).rejects.toThrow()
  expect(read).toHaveBeenCalledTimes(3)
})

test("loads one layout engine and shares its cache across callers", async () => {
  const [first, second] = await Promise.all([loadFontLayout(), loadFontLayout()])
  expect(second).toBe(first)
})

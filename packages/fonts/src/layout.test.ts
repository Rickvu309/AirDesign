import { readFile } from "node:fs/promises"
import { expect, test, vi } from "vitest"
import { LayoutFaces } from "./layout-faces.js"
import { fontRevision, loadFontLayout, servedFontName } from "./index.js"

const narrow = new URL("../../../apps/api/fonts/LiberationSansNarrow-Regular.ttf", import.meta.url)

test("starts again after a failed WASM initialization", async () => {
  const instantiate = vi.spyOn(WebAssembly, "instantiate")
  instantiate.mockRejectedValueOnce(new Error("WASM unavailable"))
  try {
    await expect(loadFontLayout()).rejects.toThrow("WASM unavailable")
    await expect(loadFontLayout()).resolves.toHaveProperty("shapeLine")
  } finally {
    instantiate.mockRestore()
  }
})

test("shapes loaded faces with UTF-16 clusters and reports missing clusters", async () => {
  const layout = await createFontLayout()
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
  const layout = await createFontLayout()
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
  const layout = await createFontLayout()
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
  const fallback = await layout.prepareFace({
    ...asset,
    key: "geist",
    read: () => readFile(new URL("../../../apps/api/fonts/Geist[wght].ttf", import.meta.url)),
  })
  const differentStack = shape([
    { ...style, range: { start: 0, end: 1 }, faces: [first] },
    { ...style, range: { start: 1, end: text.length }, faces: [second, fallback] },
  ])
  expect(
    differentStack.kind === "shaped" && whole.kind === "shaped" && differentStack.advance - whole.advance,
  ).toBeGreaterThan(2)
})

test("reads a second face while the first face is still loading", async () => {
  const layout = await createFontLayout()
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

test("reads an unavailable face again after the backoff", async () => {
  const layout = await loadFontLayout()
  const read = vi.fn(async (): Promise<Uint8Array<ArrayBuffer>> => {
    throw new Error("unavailable")
  })
  const asset = { revision: "unavailable-revision", key: "narrow", axes: {}, read }
  vi.useFakeTimers({ toFake: ["Date"] })
  try {
    for (let attempt = 0; attempt < 3; attempt++) await expect(layout.prepareFace(asset)).rejects.toThrow("unavailable")
    read.mockImplementation(() => readFile(narrow))
    vi.setSystemTime(Date.now() + 59_999)
    await expect(layout.prepareFace(asset)).rejects.toThrow("read limit")
    expect(read).toHaveBeenCalledTimes(3)
    vi.setSystemTime(Date.now() + 1)
    await expect(layout.prepareFace(asset)).resolves.toHaveProperty("sha256")
    expect(read).toHaveBeenCalledTimes(4)
  } finally {
    vi.useRealTimers()
  }
})

test.each(["ja-u-lw-phrase", "ja@lw=phrase", "ja-u-lb-loose-lw-phrase"])(
  "refuses phrase breaking in %s",
  async (locale) => {
    const layout = await loadFontLayout()
    expect(() => layout.breaks({ text: "東京都美術館", locale })).toThrow("Phrase")
  },
)

test("loads one layout engine and shares its cache across callers", async () => {
  const [first, second] = await Promise.all([createFontLayout(), createFontLayout()])
  expect(second).toBe(first)
})

test("flows served text around URLs, spaces and discretionary hyphens", async () => {
  const layout = await loadFontLayout()
  const face = await layout.prepareFace({
    revision: fontRevision,
    key: "geist",
    axes: {},
    read: () => readFile(new URL("../../../apps/api/fonts/Geist[wght].ttf", import.meta.url)),
  })
  const flow = (text: string, width: number) =>
    layout.flow({
      paragraph: {
        text,
        locale: "und",
        direction: "auto",
        sourceOffsetByTextOffset: [],
        runs: [{ range: { start: 0, end: text.length }, size: 44, tracking: 0, faces: [face] }],
      },
      width,
      emergency: true,
      twoLines: false,
      missingFace: face,
    })
  const url = "https://example.com/one/two/three"
  expect(flow(url, 110)?.lines.map(({ range }) => range)).toEqual([{ start: 0, end: url.length }])
  const soft = flow("soft\u00adhy", 110)
  expect(soft?.lines).toMatchObject([
    { range: { start: 0, end: 5 }, display: "soft-" },
    { range: { start: 5, end: 7 } },
  ])
  expect(flow("a  b", 38)?.lines.map(({ range }) => range)).toEqual([
    { start: 0, end: 3 },
    { start: 3, end: 4 },
  ])
  expect(flow("a🫠b", Infinity)?.lines[0]?.display).toBe("a?\u2060b")
})

test("keeps pinned faces above the soft budget and admits more only after a pin is released", async () => {
  await loadFontLayout()
  const bytes = await readFile(narrow)
  const size = bytes.byteLength
  const files = new LayoutFaces(size, 2 * size)
  const revision = (n: number) => String(n)
  const prepare = (n: number, onEvict = () => {}) =>
    files.prepare({ revision: revision(n), key: "test-file", axes: {}, read: async () => bytes, onEvict })
  const unpinFirst = files.pin(revision(1), "test-file")
  const unpinSecond = files.pin(revision(2), "test-file")
  const unpinThird = files.pin(revision(3), "test-file")
  const evicted = vi.fn()
  const one = await prepare(1, evicted)
  const two = await prepare(2)
  expect(files.cache().bytes).toBe(2 * size)
  await expect(prepare(3)).rejects.toThrow("Pinned faces exceed the hard cap")
  expect(files.has(one)).toBe(true)
  expect(files.has(two)).toBe(true)
  expect(evicted).not.toHaveBeenCalled()
  unpinFirst()
  const three = await prepare(3)
  expect(files.has(one)).toBe(false)
  expect(files.has(two)).toBe(true)
  expect(files.has(three)).toBe(true)
  expect(evicted).toHaveBeenCalledOnce()
  unpinSecond()
  unpinThird()
})

test("admits an export face ahead of a filmstrip face under the pinned cap", async () => {
  await loadFontLayout()
  const bytes = await readFile(narrow)
  const files = new LayoutFaces(bytes.byteLength, 2 * bytes.byteLength)
  const prepare = (key: string) => files.prepare({ revision: key, key, axes: {}, read: async () => bytes })
  files.pin("filmstrip", "filmstrip", 0)
  files.pin("canvas", "canvas", 1)
  files.pin("export", "export", 2)
  const thumb = await prepare("filmstrip")
  const canvas = await prepare("canvas")
  const printed = await prepare("export")
  expect(files.has(thumb)).toBe(false)
  expect(files.has(canvas)).toBe(true)
  expect(files.has(printed)).toBe(true)
  expect(files.cache().bytes).toBe(2 * bytes.byteLength)
})

test("infers one Han language from every text in a deck", async () => {
  const { hanLanguage } = await import("./script-fonts.js")
  for (const title of ["東京本社", "営業報告", "市場概況", "業績報告", "営業利益", "売上高", "社外秘", "42億円"])
    expect(hanLanguage([title]), title).toBe("und")
  for (const title of ["繁體中文", "臺灣經濟展望", "營業報告", "鬱鬱蔥蔥"])
    expect(hanLanguage([title]), title).toBe("zh-Hant")
  for (const title of ["市场概况", "营业报告", "收入同比增长"]) expect(hanLanguage([title]), title).toBe("und")
  expect(hanLanguage(["市场概况", "收入"])).toBe("und")
  expect(hanLanguage(["市場概況", "売上高", "まとめ"])).toBe("ja")
  expect(hanLanguage(["繁體中文", "시장"])).toBe("ko")
  expect(hanLanguage(["鬱鬱蔥蔥"])).toBe("zh-Hant")
  expect(hanLanguage(["繁體中文", "시장", "まとめ"])).toBe("ja")
})

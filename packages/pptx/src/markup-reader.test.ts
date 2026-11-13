import { describe, expect, it } from "vitest"
import { readMarkup, type MarkupDocument } from "./markup-reader.js"
import { encodeUtf8 } from "./package-bytes.js"
import { readContainer, stored } from "./package-container.js"
import { packageLimits, scanMarkup } from "./package-limits.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string, encoding?: "utf8"): Uint8Array & string }
  getBuiltinModule(name: "node:zlib"): { inflateRawSync(data: Uint8Array): Uint8Array }
  getBuiltinModule(name: "node:crypto"): {
    createHash(name: "sha256"): { update(text: string): void; digest(encoding: "hex"): string }
  }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
const { inflateRawSync } = process.getBuiltinModule("node:zlib")
const { createHash } = process.getBuiltinModule("node:crypto")
const fixtures = `${process.cwd()}/scripts/pptx-fixtures`

type Recorded = { readonly parts: number; readonly elements: number; readonly digest: string }

const shape = (document: MarkupDocument) => [
  document.wellFormed,
  document.depth,
  document.attributes,
  document.nodes,
  document.elements.map((item) => [
    item.index,
    item.kind,
    item.id,
    item.start,
    item.end,
    item.openEnd,
    item.closeStart,
    item.selfClosing,
    item.depth,
    item.parent,
    item.attributes.map((attribute) => [attribute.name, attribute.value, attribute.valueStart, attribute.valueEnd]),
  ]),
]

function recordDeck(path: string): Recorded {
  const parts = readContainer(new Uint8Array(readFileSync(path)))
    .filter((record) => record.name.endsWith(".xml") || record.name.endsWith(".rels"))
    .map((record) => [record.name, record.method === stored ? record.stream : inflateRawSync(record.stream)] as const)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  const hash = createHash("sha256")
  let elements = 0
  for (const [name, bytes] of parts) {
    const document = readMarkup(bytes, true)
    elements += document.elements.length
    hash.update(`${name}\n${JSON.stringify(shape(readMarkup(bytes, false)))}\n${JSON.stringify(shape(document))}\n`)
  }
  return { parts: parts.length, elements, digest: hash.digest("hex") }
}

function rows(xml: string | Uint8Array, full = true) {
  const document = readMarkup(typeof xml === "string" ? encodeUtf8(xml) : xml, full)
  return {
    wellFormed: document.wellFormed,
    depth: document.depth,
    attributes: document.attributes,
    nodes: document.nodes,
    elements: document.elements.map(
      (item) =>
        `${item.kind} ${item.start} ${item.openEnd} ${item.closeStart} ${item.end}${item.selfClosing ? " /" : ""} ` +
        `depth ${item.depth} parent ${item.parent}` +
        item.attributes.map((each) => ` ${JSON.stringify(each.name)}=${each.valueStart}-${each.valueEnd}`).join(""),
    ),
  }
}

function value(xml: string, name: string): string | undefined {
  return readMarkup(encodeUtf8(xml), true)
    .elements.flatMap((item) => item.attributes)
    .find((attribute) => attribute.name === name)?.value
}

describe("readMarkup on the fixture decks", () => {
  const recorded = JSON.parse(readFileSync(`${fixtures}/markup-digests.json`, "utf8")) as Record<string, Recorded>

  it("gives every XML part the elements, offsets and refusals the sax-wasm reader gave", () => {
    const decks = Object.keys(recorded)
    expect(decks.length).toBe(38)
    for (const deck of decks) expect([deck, recordDeck(`${fixtures}/${deck}`)]).toEqual([deck, recorded[deck]])
  })
})

describe("readMarkup on awkward markup", () => {
  it("counts bytes after a byte order mark and an XML declaration with CRLF", () => {
    const xml = `﻿<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<p:sld xmlns:a="http://a" xmlns:p="http://p"><p:cSld/></p:sld>`
    expect(rows(xml)).toEqual({
      wellFormed: true,
      depth: 2,
      attributes: 2,
      nodes: 2,
      elements: [
        'p:sld 60 105 114 122 depth 1 parent -1 "xmlns:a"=76-84 "xmlns:p"=95-103',
        "p:cSld 105 114 105 114 / depth 2 parent 0",
      ],
    })
  })

  it("reads both branches of alternate content as elements", () => {
    const xml = `<mc:AlternateContent xmlns:mc="m"><mc:Choice Requires="p14"><p14:x/></mc:Choice><mc:Fallback><p:y/></mc:Fallback></mc:AlternateContent>`
    expect(rows(xml).elements).toEqual([
      'mc:AlternateContent 0 34 113 135 depth 1 parent -1 "xmlns:mc"=31-32',
      'mc:Choice 34 60 68 80 depth 2 parent 0 "Requires"=55-58',
      "p14:x 60 68 60 68 / depth 3 parent 1",
      "mc:Fallback 80 93 99 113 depth 2 parent 0",
      "p:y 93 99 93 99 / depth 3 parent 3",
    ])
  })

  it("skips markup inside cdata, comments and an instruction that ends at its first >", () => {
    expect(rows(`<a><![CDATA[<b x="1"/>]]><!-- <c/> --><?pi d>e?><f/></a>`).elements).toEqual([
      "a 0 3 52 56 depth 1 parent -1",
      "f 48 52 48 52 / depth 2 parent 0",
    ])
  })

  it("keeps references raw and spans quotes, > and non-Latin values by byte", () => {
    expect(value(`<a:t b="&amp;&#x41;&lt;">A &amp; B &#x1F600;</a:t>`, "b")).toBe("&amp;&#x41;&lt;")
    expect(rows(`<a b="x > y" c='say "hi"' d="it's"/>`).elements).toEqual([
      'a 0 36 0 36 / depth 1 parent -1 "b"=6-11 "c"=16-24 "d"=29-33',
    ])
    expect(value(`<a b="x > y" c='say "hi"'/>`, "c")).toBe('say "hi"')
    expect(rows(`<a b="😀日本" c="עברית">ру́сский 😀</a>`).elements).toEqual([
      'a 0 33 54 58 depth 1 parent -1 "b"=6-16 "c"=21-31',
    ])
    expect(value(`<a b="😀日本"/>`, "b")).toBe("😀日本")
  })

  it("reads CRLF and tabs between attributes and a carriage return kept in a name", () => {
    expect(rows(`<a\r\n\tb = "1"\r\n\tc='2'\r\n/>`).elements).toEqual([
      'a 0 24 0 24 / depth 1 parent -1 "b"=10-11 "c"=18-19',
    ])
    expect(rows(`<a b\r="1"/>`).elements).toEqual(['a 0 11 0 11 / depth 1 parent -1 "b\\r"=7-8'])
  })

  it("spans a value longer than 64 KiB and text of surrogate pairs that crosses 64 KiB", () => {
    expect(rows(`<a b="${"x".repeat(100_000)}" c="1"/>`).elements).toEqual([
      'a 0 100015 0 100015 / depth 1 parent -1 "b"=6-100006 "c"=100011-100012',
    ])
    expect(rows(`<r>${"😀".repeat(16_383)}x<b c="ü"/></r>`).elements).toEqual([
      "r 0 3 65547 65551 depth 1 parent -1",
      'b 65536 65547 65536 65547 / depth 2 parent 0 "c"=65542-65544',
    ])
  })

  it("accepts a close tag with a space before > for limits and refuses its spans", () => {
    expect(rows("<a></a >", false).wellFormed).toBe(true)
    expect(rows("<a></a >")).toMatchObject({ wellFormed: false, elements: ["a 0 3 3 8 depth 1 parent -1"] })
    expect(rows("<üx></üx>", false).wellFormed).toBe(true)
    expect(rows("<üx></üx>")).toMatchObject({ wellFormed: false, elements: ["üx 0 5 5 11 depth 1 parent -1"] })
  })

  it("reads < and the character after it as text when that character cannot start a name", () => {
    for (const xml of ["<<a/>", "< a/>", "<1a/>", "<“a/>"])
      expect([xml, rows(xml)]).toEqual([xml, { wellFormed: true, depth: 0, attributes: 0, nodes: 0, elements: [] }])
    expect(rows("<a>1 < 2 <= 3</a>").elements).toEqual(["a 0 3 13 17 depth 1 parent -1"])
  })

  it("starts an element whose name begins with a non-ASCII letter at its <", () => {
    expect(rows("<ü/>").elements).toEqual(["ü 0 5 0 5 / depth 1 parent -1"])
  })
})

describe("readMarkup refusals", () => {
  const refusedBefore = [
    "<!DOCTYPE a><a/>",
    "<a>",
    "<a></b>",
    "<a><!--",
    "<a/>x</b>",
    "<a><b></a></b>",
    "<a></a\t>",
    "<a><![CDATA[x</a>",
    "<a b/>",
    "<a></>",
  ]
  const refusedNow = [
    "<a b=c/>",
    "<a b={1}/>",
    "<a/",
    "<a",
    '<a b="x',
    "<a><![cdata[<b>]]></a>",
    "<!ENTITY x><a/>",
    "<a><b></a>",
    "<a/><!--",
    "<a/><?x",
    "<a/><",
    "<a / ></a>",
    "<></>",
    "<a></ a>",
    `<a b"c="1"/>`,
    "<a<b/>",
  ]

  it("refuses everything the sax-wasm reader refused, in both modes", () => {
    for (const xml of refusedBefore)
      expect([xml, rows(xml, false).wellFormed, rows(xml).wellFormed]).toEqual([xml, false, false])
  })

  it("refuses malformed markup the sax-wasm reader let through", () => {
    for (const xml of refusedNow) expect([xml, rows(xml, false).wellFormed]).toEqual([xml, false])
    const orphan = encodeUtf8(`<a>${" ".repeat(70_000)}</a></b>`)
    expect(readMarkup(orphan, false).wellFormed).toBe(false)
  })

  it("refuses bytes that are not UTF-8", () => {
    expect(readMarkup(Uint8Array.of(60, 97, 32, 98, 61, 34, 0xff, 34, 47, 62), false).wellFormed).toBe(false)
    expect(readMarkup(Uint8Array.of(60, 97, 62, 0xe6, 0x97, 60, 47, 97, 62), false).wellFormed).toBe(false)
    expect(readMarkup(Uint8Array.of(60, 97, 62, 0xed, 0xa0, 0x80, 60, 47, 97, 62), false).wellFormed).toBe(false)
    expect(readMarkup(Uint8Array.of(60, 97, 62, 0xc0, 0xbc, 60, 47, 97, 62), false).wellFormed).toBe(false)
  })
})

type Expected = {
  kind: string
  start: number
  openEnd: number
  closeStart: number
  end: number
  selfClosing: boolean
  depth: number
  parent: number
  attributes: (readonly [string, string, number, number])[]
}

const kinds = ["p:sp", "a:t", "mc:AlternateContent", "mc:Choice", "Relationship", "a", "x.y-z_1"]
const names = ["id", "name", "r:embed", "xmlns:a", "Requires", "b"]
const values = [
  "",
  "1",
  "x > y",
  "it's",
  'say "hi"',
  "&amp;&#x41;&lt;",
  "😀日本",
  "a\r\nb",
  "\t",
  "</a>",
  "x".repeat(70_000),
]
const blanks = [" ", "\n", "\r\n", "\t", "  "]
const equalsSigns = ["=", " = ", "\t=\t", "\n="]
const contents = [
  "A &amp; B",
  "😀 русский עברית",
  "\r\n",
  "1 &lt; 2",
  "x > y",
  "]]",
  "<!-- <c/> -->",
  "<![CDATA[<b x='1'>]]>",
  "<?pi z?>",
]

function generated(seed: number) {
  let state = seed
  const pick = <T>(list: readonly T[]): T => {
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff
    const chosen = list[state % list.length]
    if (chosen === undefined) throw new Error("pick")
    return chosen
  }
  const chunks: Uint8Array[] = []
  let length = 0
  const put = (text: string) => {
    const bytes = encodeUtf8(text)
    chunks.push(bytes)
    length += bytes.length
  }
  const expected: Expected[] = []
  const element = (depth: number, parent: number) => {
    const kind = pick(kinds)
    const row: Expected = {
      kind,
      start: length,
      openEnd: 0,
      closeStart: 0,
      end: 0,
      selfClosing: false,
      depth,
      parent,
      attributes: [],
    }
    const index = expected.length
    expected.push(row)
    put(`<${kind}`)
    for (let count = pick([0, 0, 1, 2, 3]); count > 0; count -= 1) {
      const text = pick(values)
      const quote = text.includes('"') ? "'" : text.includes("'") ? '"' : pick(['"', "'"])
      const name = pick(names)
      put(`${pick(blanks)}${name}${pick(equalsSigns)}${quote}`)
      const valueStart = length
      put(text)
      row.attributes.push([name, text, valueStart, length])
      put(quote)
    }
    put(pick(["", "", " "]))
    row.selfClosing = depth > 5 || pick([true, false, false])
    if (row.selfClosing) {
      put("/>")
      row.closeStart = row.start
      row.openEnd = row.end = length
      return
    }
    put(">")
    row.openEnd = length
    for (let count = pick([0, 1, 2, 3]); count > 0; count -= 1) {
      if (pick([true, false])) element(depth + 1, index)
      else put(pick(contents))
    }
    row.closeStart = length
    put(`</${kind}>`)
    row.end = length
  }
  put(pick(["", "﻿", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n']))
  element(1, -1)
  put(pick(["", "\n", "<!-- end -->"]))
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return { bytes, expected }
}

describe("readMarkup on generated documents", () => {
  it("spans every element and attribute value of a well-formed document and refuses each cut inside its root", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const { bytes, expected } = generated(seed)
      const document = readMarkup(bytes, true)
      const got = document.elements.map((item): Expected => ({
        kind: item.kind,
        start: item.start,
        openEnd: item.openEnd,
        closeStart: item.closeStart,
        end: item.end,
        selfClosing: item.selfClosing,
        depth: item.depth,
        parent: item.parent,
        attributes: item.attributes.map((each) => [each.name, each.value, each.valueStart, each.valueEnd] as const),
      }))
      expect([seed, document.wellFormed, got]).toEqual([seed, true, expected])
      const limits = readMarkup(bytes, false)
      expect([seed, limits.wellFormed, limits.nodes, limits.depth]).toEqual([
        seed,
        true,
        expected.length,
        Math.max(...expected.map((item) => item.depth)),
      ])
      const root = expected[0]
      if (root === undefined) throw new Error("root")
      for (const cut of [root.start + 1, root.openEnd - 1, Math.floor((root.start + root.end) / 2), root.end - 1]) {
        expect([seed, cut, readMarkup(bytes.subarray(0, cut), false).wellFormed]).toEqual([seed, cut, false])
      }
      const stray = new Uint8Array(bytes.length + 4)
      stray.set(bytes)
      stray.set(encodeUtf8("</q>"), bytes.length)
      expect([seed, readMarkup(stray, false).wellFormed]).toEqual([seed, false])
    }
  })
})

function repeated(unit: string, count: number): Uint8Array {
  const piece = encodeUtf8(unit)
  const bytes = new Uint8Array(piece.length * count)
  bytes.set(piece)
  for (let filled = piece.length; filled < bytes.length; filled *= 2) bytes.copyWithin(filled, 0, filled)
  return bytes
}

function joined(...pieces: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0))
  let offset = 0
  for (const piece of pieces) {
    bytes.set(piece, offset)
    offset += piece.length
  }
  return bytes
}

describe("readMarkup on hostile input", () => {
  const eight = 8 * 1024 * 1024

  it("measures deep nesting and refuses it at the depth cap", () => {
    const depth = 200_000
    const nested = joined(repeated("<a>", depth), repeated("</a>", depth))
    expect(readMarkup(nested, false)).toMatchObject({ wellFormed: true, depth, nodes: depth })
    expect(scanMarkup(nested, packageLimits, 0)).toEqual({ ok: false, reason: "limit", limit: "depth" })
    expect(readMarkup(repeated("<a>", depth), false).wellFormed).toBe(false)
  })

  it("reads a huge value, many attributes and many references in one pass", () => {
    const huge = joined(encodeUtf8('<a b="'), repeated("x", eight), encodeUtf8('"/>'))
    expect(readMarkup(huge, true).elements[0]?.attributes[0]).toMatchObject({ valueStart: 6, valueEnd: eight + 6 })
    const many = joined(encodeUtf8("<a"), repeated(' b="1"', 100_000), encodeUtf8("/>"))
    expect(readMarkup(many, false)).toMatchObject({ wellFormed: true, attributes: 100_000 })
    expect(scanMarkup(many, packageLimits, 0)).toEqual({ ok: false, reason: "limit", limit: "attributes" })
    const references = joined(
      encodeUtf8('<a b="'),
      repeated("&amp;", 1_000_000),
      encodeUtf8('">'),
      repeated("&lt;&#x1F600;", 500_000),
      encodeUtf8("</a>"),
    )
    expect(readMarkup(references, false)).toMatchObject({ wellFormed: true, nodes: 1 })
  })

  it("refuses unterminated constructs repeated to fill a part", () => {
    for (const unit of ["<!--", "<?", "<![CDATA[", '<a b="', "</", "<a", "<a "]) {
      const bytes = repeated(unit, Math.floor(eight / unit.length))
      expect([unit, readMarkup(bytes, false).wellFormed]).toEqual([unit, false])
    }
    expect(readMarkup(joined(repeated("<", eight), encodeUtf8("a/>")), false)).toMatchObject({
      wellFormed: true,
      nodes: 0,
    })
  })
})

import type { TextParagraph, TextValue } from "@airdesign/document"
import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { markupDocument, spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8, readParts } from "./package-bytes.js"
import { readShapes } from "./read-shapes.js"
import { xmlText } from "./shape-write.js"
import { applyRoute, oneRunOf, oneRunValue, shapeById } from "./slide-route.js"
import { decodedXmlText, markupChildren, oneRunIn, shapeTextValue } from "./text-value-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
const fixture = (name: string) => `${process.cwd()}/scripts/pptx-fixtures/${name}`
const part = "ppt/slides/slide1.xml"

type GeneratedInline =
  | { readonly kind: "run"; readonly text: string; readonly format: boolean; readonly closed: boolean }
  | { readonly kind: "break" }
  | { readonly kind: "field"; readonly text: string }

type GeneratedParagraph = {
  readonly properties: boolean
  readonly inlines: readonly GeneratedInline[]
  readonly end: boolean
  readonly gap: boolean
  readonly closed: boolean
}

type Change = "keep" | "retext" | "drop" | "add" | "split" | "delete"
type Written = TextParagraph & { readonly rebuilt: boolean }

const letters = ["a", "b", "Z", " ", "&", "<", ">", "é", "😀"]
const safeText = fc.array(fc.constantFrom(...letters), { maxLength: 6 }).map((chars) => chars.join(""))
const inlineArb: fc.Arbitrary<GeneratedInline> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant("run" as const),
      text: safeText,
      format: fc.boolean(),
      closed: fc.boolean(),
    }),
  },
  { weight: 1, arbitrary: fc.constant({ kind: "break" as const }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant("field" as const), text: safeText }) },
)
const paragraphArb: fc.Arbitrary<GeneratedParagraph> = fc.record({
  properties: fc.boolean(),
  inlines: fc.array(inlineArb, { maxLength: 4 }),
  end: fc.boolean(),
  gap: fc.boolean(),
  closed: fc.boolean(),
})
const bodyArb = fc.array(paragraphArb, { minLength: 1, maxLength: 4 })
const changeArb = fc.constantFrom<Change>("keep", "retext", "drop", "add", "split", "delete")

function selfClosedParagraph(paragraph: GeneratedParagraph): boolean {
  return paragraph.closed && !paragraph.properties && !paragraph.end && paragraph.inlines.length === 0
}

function inlineSource(inline: GeneratedInline, paragraph: number, at: number): string {
  if (inline.kind === "break") return `<a:br><a:rPr sz="${paragraph}${at}"/></a:br>`
  if (inline.kind === "field") {
    return `<a:fld id="{${paragraph}${at}}" type="slidenum"><a:rPr/><a:t>${xmlText(inline.text)}</a:t></a:fld>`
  }
  const format = inline.format ? `<a:rPr sz="${paragraph}${at}" b="1"/>` : ""
  if (inline.text === "" && inline.closed) return `<a:r>${format}<a:t/></a:r>`
  return `<a:r>${format}<a:t>${xmlText(inline.text).replaceAll("Z", "&#90;")}</a:t></a:r>`
}

function paragraphSource(paragraph: GeneratedParagraph, index: number): string {
  if (selfClosedParagraph(paragraph)) return "<a:p/>"
  const gap = paragraph.gap ? "\n  " : ""
  const parts: string[] = []
  if (paragraph.properties) parts.push(`<a:pPr marL="${index}"/>`)
  parts.push(...paragraph.inlines.map((inline, at) => inlineSource(inline, index, at)))
  if (paragraph.end) parts.push(`<a:endParaRPr sz="9${index}"/>`)
  return `<a:p>${parts.join(gap)}</a:p>`
}

function slideSource(body: readonly GeneratedParagraph[]): Uint8Array {
  const other = (id: string, text: string) =>
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="O"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr wrap="none"><a:normAutofit/></a:bodyPr><a:lstStyle><a:lvl1pPr/></a:lstStyle>${body.map(paragraphSource).join("")}</p:txBody></p:sp>`
  return encodeUtf8(`<p:spTree>${other("20", "before")}${shape}${other("21", "after")}</p:spTree>`)
}

type Body = {
  readonly bytes: Uint8Array
  readonly children: ReturnType<typeof markupChildren>
  readonly paragraphs: readonly MarkupElement[]
}

function bodyOf(bytes: Uint8Array): Body {
  const document = markupDocument(bytes)
  expect(document.wellFormed).toBe(true)
  const shape = shapeById(document.elements, "2")
  const children = markupChildren(document.elements)
  const body = children[shape.index]?.find((element) => element.kind === "p:txBody")
  if (body === undefined) throw new Error("body")
  return { bytes, children, paragraphs: (children[body.index] ?? []).filter((element) => element.kind === "a:p") }
}

function readValue(bytes: Uint8Array): TextValue {
  const document = markupDocument(bytes)
  return shapeTextValue(markupChildren(document.elements), bytes, shapeById(document.elements, "2"))
}

function expectedValue(body: readonly GeneratedParagraph[]): TextValue {
  return body.map((paragraph, from) => ({
    from,
    runs: paragraph.inlines.map((inline, at) => ({
      from: at,
      text: inline.kind === "break" ? "\n" : inline.text,
    })),
  }))
}

function edited(before: Uint8Array, value: TextValue): Uint8Array {
  const after = applyRoute(new Map([[part, before]]), { name: "text", part, shape: "2", value }).get(part)
  if (after === undefined) throw new Error("part")
  return after
}

function childrenOf(body: Body, element: MarkupElement | undefined): readonly MarkupElement[] {
  return element === undefined ? [] : (body.children[element.index] ?? [])
}

function spanOf(body: Body, element: MarkupElement | undefined): Uint8Array {
  return element === undefined ? new Uint8Array(0) : body.bytes.subarray(element.start, element.end)
}

function kindOf(body: Body, parent: MarkupElement | undefined, kind: string): MarkupElement | undefined {
  return childrenOf(body, parent).find((element) => element.kind === kind)
}

const inlineKinds = new Set(["a:r", "a:br", "a:fld"])

function inlinesOf(body: Body, paragraph: MarkupElement | undefined): readonly MarkupElement[] {
  return childrenOf(body, paragraph).filter((element) => inlineKinds.has(element.kind))
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const merged = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0))
  let at = 0
  for (const chunk of chunks) {
    merged.set(chunk, at)
    at += chunk.length
  }
  return merged
}

function textSpan(holder: MarkupElement, text: string): ByteEdit {
  return holder.selfClosing
    ? { start: holder.start, end: holder.end, next: encodeUtf8(`<a:t>${xmlText(text)}</a:t>`) }
    : { start: holder.openEnd, end: holder.closeStart, next: encodeUtf8(xmlText(text)) }
}

function keptParagraph(source: Body, element: MarkupElement, written: TextParagraph): Uint8Array {
  const original = decodedRuns(source, element)
  const edits: ByteEdit[] = []
  for (const [at, run] of written.runs.entries()) {
    if (run.text === original[at]) continue
    const inline = inlinesOf(source, element)[at]
    const holder = kindOf(source, inline, "a:t")
    if (holder === undefined) throw new Error("holder")
    edits.push(textSpan(holder, run.text))
  }
  return spliceBytes(source.bytes.subarray(element.start, element.end), offset(edits, element.start))
}

function offset(edits: readonly ByteEdit[], at: number): readonly ByteEdit[] {
  return edits.map((edit) => ({ start: edit.start - at, end: edit.end - at, next: edit.next }))
}

function decodedRuns(source: Body, element: MarkupElement): readonly string[] {
  return inlinesOf(source, element).map((inline) => {
    if (inline.kind === "a:br") return "\n"
    const holder = kindOf(source, inline, "a:t")
    if (holder === undefined || holder.selfClosing) return ""
    return decodedXmlText(decodeUtf8(source.bytes.subarray(holder.openEnd, holder.closeStart)))
  })
}

function expectedRun(source: Body, paragraph: MarkupElement, run: { from: number; text: string }): Uint8Array {
  const open = encodeUtf8("<a:r>")
  const text = encodeUtf8(`<a:t>${xmlText(run.text)}</a:t></a:r>`)
  if (run.from === -1) {
    const end = kindOf(source, paragraph, "a:endParaRPr")
    if (end === undefined) return concat([open, text])
    return concat([
      open,
      encodeUtf8("<a:rPr"),
      source.bytes.subarray(end.start + "<a:endParaRPr".length, end.end),
      text,
    ])
  }
  const inline = inlinesOf(source, paragraph)[run.from]
  if (inline === undefined) throw new Error("run")
  if (inline.kind !== "a:r") return spanOf(source, inline)
  return concat([open, spanOf(source, kindOf(source, inline, "a:rPr")), text])
}

function rebuiltParagraph(source: Body, element: MarkupElement, written: TextParagraph): Uint8Array {
  return concat([
    encodeUtf8("<a:p>"),
    spanOf(source, kindOf(source, element, "a:pPr")),
    ...written.runs.map((run) => expectedRun(source, element, run)),
    spanOf(source, kindOf(source, element, "a:endParaRPr")),
    encodeUtf8("</a:p>"),
  ])
}

function appliedChange(
  value: TextValue,
  from: number,
  change: Change,
  text: string,
  pick: number,
  generated: GeneratedParagraph,
): readonly Written[] {
  const source = value[from]
  if (source === undefined) throw new Error("source")
  const runs = source.runs
  const kept: Written = { from, runs, rebuilt: false }
  if (change === "keep") return [kept]
  if (change === "delete") return []
  if (change === "retext") {
    const at = generated.inlines.findIndex((inline) => inline.kind === "run")
    if (at < 0) return [kept]
    return [{ from, runs: runs.map((run, index) => (index === at ? { from: run.from, text } : run)), rebuilt: false }]
  }
  if (change === "add") return [{ from, runs: [...runs, { from: -1, text }], rebuilt: true }]
  if (change === "drop") {
    if (runs.length === 0) return [kept]
    return [{ from, runs: runs.filter((_, index) => index !== pick % runs.length), rebuilt: true }]
  }
  const cut = runs.length === 0 ? 0 : pick % (runs.length + 1)
  return [
    { from, runs: runs.slice(0, cut), rebuilt: cut !== runs.length },
    { from, runs: runs.slice(cut), rebuilt: true },
  ]
}

function changedValue(
  body: readonly GeneratedParagraph[],
  changes: readonly (readonly [Change, string, number])[],
): readonly Written[] {
  const value = expectedValue(body)
  const written = value.flatMap((_, from) => {
    const [change, text, pick] = changes[from % changes.length] ?? ["keep", "", 0]
    const generated = body[from]
    if (generated === undefined) throw new Error("generated")
    return appliedChange(value, from, change, text, pick, generated)
  })
  return written.length > 0 ? written : [{ from: 0, runs: value[0]?.runs ?? [], rebuilt: false }]
}

function expectUntouchedOutside(before: Body, after: Body): void {
  const first = before.paragraphs[0]
  const last = before.paragraphs.at(-1)
  const nextFirst = after.paragraphs[0]
  const nextLast = after.paragraphs.at(-1)
  if (first === undefined || last === undefined || nextFirst === undefined || nextLast === undefined)
    throw new Error("paragraph")
  expect(after.bytes.subarray(0, nextFirst.start)).toEqual(before.bytes.subarray(0, first.start))
  expect(after.bytes.subarray(nextLast.end)).toEqual(before.bytes.subarray(last.end))
}

describe("text value write-back", () => {
  it("writes the value it read as zero changed bytes", () => {
    fc.assert(
      fc.property(bodyArb, (body) => {
        const before = slideSource(body)
        const value = readValue(before)
        expect(value).toEqual(expectedValue(body))
        expect(edited(before, value)).toBe(before)
      }),
      { numRuns: 200 },
    )
  })

  it("changes only the a:t of the one run whose text changed", () => {
    fc.assert(
      fc.property(bodyArb, safeText, fc.nat(99), (body, text, pick) => {
        const before = slideSource(body)
        const value = readValue(before)
        const targets = body.flatMap((paragraph, from) =>
          paragraph.inlines.flatMap((inline, run) => (inline.kind === "run" ? [{ from, run, text: inline.text }] : [])),
        )
        const target = targets[pick % Math.max(targets.length, 1)]
        if (target === undefined || target.text === text) return
        const next = value.map((paragraph) =>
          paragraph.from !== target.from
            ? paragraph
            : {
                from: paragraph.from,
                runs: paragraph.runs.map((run) => (run.from === target.run ? { from: run.from, text } : run)),
              },
        )
        const parsed = bodyOf(before)
        const holder = kindOf(parsed, inlinesOf(parsed, parsed.paragraphs[target.from])[target.run], "a:t")
        if (holder === undefined) throw new Error("holder")
        expect(edited(before, next)).toEqual(spliceBytes(before, [textSpan(holder, text)]))
      }),
      { numRuns: 200 },
    )
  })

  it("keeps every byte outside the edited spans and writes only copied bytes and escaped text", () => {
    fc.assert(
      fc.property(
        bodyArb,
        fc.array(fc.tuple(changeArb, safeText, fc.nat(99)), { minLength: 1, maxLength: 6 }),
        (body, changes) => {
          const before = slideSource(body)
          const value = changedValue(body, changes)
          const after = edited(before, value)
          const parsedBefore = bodyOf(before)
          const parsedAfter = bodyOf(after)
          expect(parsedAfter.paragraphs.length).toBe(value.length)
          expectUntouchedOutside(parsedBefore, parsedAfter)
          for (const [index, written] of value.entries()) {
            const source = parsedBefore.paragraphs[written.from]
            const next = parsedAfter.paragraphs[index]
            if (source === undefined || next === undefined) throw new Error("paragraph")
            const expected = written.rebuilt
              ? rebuiltParagraph(parsedBefore, source, written)
              : keptParagraph(parsedBefore, source, written)
            expect(spanOf(parsedAfter, next)).toEqual(expected)
          }
          const back = value.map((paragraph, from) => ({
            from,
            runs: paragraph.runs.map((run, at) => ({ from: at, text: run.text })),
          }))
          expect(readValue(after)).toEqual(back)
        },
      ),
      { numRuns: 300 },
    )
  })
})

const boxOf = (body: string): Uint8Array =>
  encodeUtf8(
    `<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp></p:spTree>`,
  )
const cdataRun = `<a:r><a:rPr b="1"/><a:t><![CDATA[a<b & c]]></a:t></a:r>`
const plainRun = `<a:r><a:rPr i="1"/><a:t>next</a:t></a:r>`

describe("text inside CDATA and comments", () => {
  it("reads CDATA and a comment as the shown text", () => {
    const box = boxOf(`<a:p><a:r><a:t>x &amp; <![CDATA[a<b &amp;]]><!--note--><?pi ?>y</a:t></a:r></a:p>`)
    expect(readValue(box)).toEqual([{ from: 0, runs: [{ from: 0, text: "x & a<b &amp;y" }] }])
  })

  it("writes the value it read from a CDATA run as zero changed bytes", () => {
    const box = boxOf(`<a:p>${cdataRun}${plainRun}</a:p>`)
    expect(readValue(box)[0]?.runs[0]?.text).toBe("a<b & c")
    expect(edited(box, readValue(box))).toBe(box)
  })

  it("rebuilds a CDATA run as escaped text", () => {
    const box = boxOf(`<a:p>${cdataRun}</a:p>`)
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "a<b & c" },
          { from: -1, text: "more" },
        ],
      },
    ]
    expect(edited(box, value)).toEqual(
      boxOf(`<a:p><a:r><a:rPr b="1"/><a:t>a&lt;b &amp; c</a:t></a:r><a:r><a:t>more</a:t></a:r></a:p>`),
    )
  })

  it("replaces the content of a retyped CDATA run", () => {
    const box = boxOf(`<a:p>${cdataRun}</a:p>`)
    expect(edited(box, [{ from: 0, runs: [{ from: 0, text: "x<y" }] }])).toEqual(
      boxOf(`<a:p><a:r><a:rPr b="1"/><a:t>x&lt;y</a:t></a:r></a:p>`),
    )
  })

  it("keeps a CDATA run byte for byte when the run beside it is edited", () => {
    const box = boxOf(`<a:p>${cdataRun}${plainRun}</a:p>`)
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "a<b & c" },
          { from: 1, text: "changed" },
        ],
      },
    ]
    expect(edited(box, value)).toEqual(boxOf(`<a:p>${cdataRun}<a:r><a:rPr i="1"/><a:t>changed</a:t></a:r></a:p>`))
  })
})

describe("oneRunValue", () => {
  const nineParagraphs = Array.from({ length: 9 }, (_, index) => `<a:p><a:r><a:t>Line ${index}</a:t></a:r></a:p>`).join(
    "",
  )

  it("puts the text in the one run of a one-run box and keeps its from", () => {
    expect(oneRunIn([{ from: 3, runs: [{ from: 1, text: "Old" }] }])).toEqual({ paragraph: 3, run: 1 })
    expect(oneRunValue(new Map([[part, boxOf(`<a:p><a:r><a:t>Old</a:t></a:r></a:p>`)]]), part, "2", "New")).toEqual([
      { from: 0, runs: [{ from: 0, text: "New" }] },
    ])
  })

  it("offers a box exactly when oneRunValue would write it", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          bodyArb,
          paragraphArb.map((paragraph) => [paragraph]),
        ),
        fc.constantFrom("2", "99"),
        (body, shape) => {
          const parts = new Map([[part, slideSource(body)]])
          const offered = oneRunOf(parts, part, shape) !== null
          let written = true
          try {
            oneRunValue(parts, part, shape, "x")
          } catch {
            written = false
          }
          expect(offered).toBe(written)
        },
      ),
      { numRuns: 300 },
    )
  })

  it("throws text-shape for anything but one paragraph with one non-empty run", () => {
    const refusedValues: readonly TextValue[] = [
      [],
      [{ from: 0, runs: [] }],
      [{ from: 0, runs: [{ from: 0, text: "" }] }],
      [{ from: 0, runs: [{ from: 0, text: "\n" }] }],
      [
        {
          from: 0,
          runs: [
            { from: 0, text: "One" },
            { from: 1, text: "Two" },
          ],
        },
      ],
      [
        { from: 0, runs: [{ from: 0, text: "One" }] },
        { from: 1, runs: [{ from: 0, text: "Two" }] },
      ],
    ]
    for (const value of refusedValues) expect(oneRunIn(value)).toBeNull()
  })

  it("keeps a box with several paragraphs from reaching the route with one string", () => {
    const box = boxOf(nineParagraphs)
    const saved = Uint8Array.from(box)
    expect(() => edited(box, oneRunValue(new Map([[part, box]]), part, "2", "typed"))).toThrow(/text-shape/)
    expect(box).toEqual(saved)
  })

  it("reads the value from the shape the route edits when a fallback box shares the id", () => {
    const fallback = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="F"/></p:nvSpPr><p:txBody><a:bodyPr/>${nineParagraphs}</p:txBody></p:sp>`
    const plain = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="P"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Plain</a:t></a:r></a:p></p:txBody></p:sp>`
    const choice = `<p:sp><p:nvSpPr><p:cNvPr id="6" name="C"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>C</a:t></a:r></a:p></p:txBody></p:sp>`
    const box = encodeUtf8(
      `<p:spTree><mc:AlternateContent><mc:Choice Requires="x">${choice}</mc:Choice><mc:Fallback>${fallback}</mc:Fallback></mc:AlternateContent>${plain}</p:spTree>`,
    )
    const saved = Uint8Array.from(box)
    const parts = new Map([[part, box]])
    expect(() => oneRunValue(parts, part, "2", "typed")).toThrow(/text-shape/)
    expect(box).toEqual(saved)
  })

  it("looks the shape up the way the route does when two shapes share an id", () => {
    const one = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>One</a:t></a:r></a:p></p:txBody></p:sp>`
    const many = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="B"/></p:nvSpPr><p:txBody><a:bodyPr/>${nineParagraphs}</p:txBody></p:sp>`
    const oneFirst = new Map([[part, encodeUtf8(`<p:spTree>${one}${many}</p:spTree>`)]])
    const value = oneRunValue(oneFirst, part, "2", "typed")
    const written = applyRoute(oneFirst, { name: "text", part, shape: "2", value }).get(part) as Uint8Array
    expect(written).toEqual(encodeUtf8(`<p:spTree>${one.replace(">One<", ">typed<")}${many}</p:spTree>`))
    const manyFirst = new Map([[part, encodeUtf8(`<p:spTree>${many}${one}</p:spTree>`)]])
    expect(() => oneRunValue(manyFirst, part, "2", "typed")).toThrow(/text-shape/)
  })

  it("leaves a field box to be refused by the route with its bytes unchanged", () => {
    const box = boxOf(`<a:p><a:fld id="{1}" type="slidenum"><a:rPr/><a:t>7</a:t></a:fld></a:p>`)
    const saved = Uint8Array.from(box)
    expect(() => edited(box, oneRunValue(new Map([[part, box]]), part, "2", "8"))).toThrow(/text-carried/)
    expect(box).toEqual(saved)
  })
})

const runsOf = (value: TextValue) => value.map((paragraph) => paragraph.runs.length)

describe("doe-heat-pumps text boxes", () => {
  it("changes only the a:t of one run on slide 7 shape 45", async () => {
    const parts = await readParts(readFileSync(fixture("doe-heat-pumps.pptx")))
    const name = "ppt/slides/slide7.xml"
    const row = readShapes(parts).find((item) => item.part === name && item.shape === "45")
    if (row === undefined) throw new Error("row")
    expect(runsOf(row.text)).toEqual([1, 1, 3, 3])
    const value = row.text.map((paragraph) =>
      paragraph.from !== 2
        ? paragraph
        : {
            from: 2,
            runs: paragraph.runs.map((run) => (run.from === 1 ? { from: 1, text: "AirDesignProbe" } : run)),
          },
    )
    const edited = applyRoute(parts, { name: "text", part: name, shape: "45", value })
    const before = parts.get(name) as Uint8Array
    const after = edited.get(name) as Uint8Array
    const document = markupDocument(before)
    const shape = shapeById(document.elements, "45")
    const body = markupChildren(document.elements)
    const holder = (body[shape.index] ?? [])
      .filter((element) => element.kind === "p:txBody")
      .flatMap((element) => (body[element.index] ?? []).filter((item) => item.kind === "a:p"))
      .flatMap((paragraph, at) => (at === 2 ? (body[paragraph.index] ?? []).filter((item) => item.kind === "a:r") : []))
      .flatMap((run, at) => (at === 1 ? (body[run.index] ?? []).filter((item) => item.kind === "a:t") : []))[0]
    if (holder === undefined) throw new Error("holder")
    expect(after).toEqual(
      spliceBytes(before, [{ start: holder.openEnd, end: holder.closeStart, next: encodeUtf8("AirDesignProbe") }]),
    )
    for (const [key, bytes] of parts) if (key !== name) expect(edited.get(key)).toBe(bytes)
  }, 30_000)

  it("writes into the empty box on slide 1 and refuses the field on slide 3", async () => {
    const parts = await readParts(readFileSync(fixture("doe-heat-pumps.pptx")))
    const noRun = "ppt/slides/slide1.xml"
    const field = "ppt/slides/slide3.xml"
    const empty = readShapes(parts).find((item) => item.part === noRun && item.shape === "4")
    const number = readShapes(parts).find((item) => item.part === field && item.shape === "4")
    if (empty === undefined || number === undefined) throw new Error("row")
    expect(applyRoute(parts, { name: "text", part: noRun, shape: "4", value: empty.text }).get(noRun)).toBe(
      parts.get(noRun),
    )
    const typed = empty.text.map((paragraph, at) =>
      at === 0 ? { from: paragraph.from, runs: [{ from: -1, text: "Typed" }] } : paragraph,
    )
    const filled = applyRoute(parts, { name: "text", part: noRun, shape: "4", value: typed })
    expect(readShapes(filled).find((item) => item.part === noRun && item.shape === "4")?.text[0]?.runs).toEqual([
      { from: 0, text: "Typed" },
    ])
    expect(applyRoute(parts, { name: "text", part: field, shape: "4", value: number.text }).get(field)).toBe(
      parts.get(field),
    )
    const changed = number.text.map((paragraph) => ({
      from: paragraph.from,
      runs: paragraph.runs.map((run) => ({ from: run.from, text: `${run.text}9` })),
    }))
    const saved = Uint8Array.from(parts.get(field) as Uint8Array)
    expect(() => applyRoute(parts, { name: "text", part: field, shape: "4", value: changed })).toThrow(/text-carried/)
    expect(parts.get(field)).toEqual(saved)
  }, 30_000)
})

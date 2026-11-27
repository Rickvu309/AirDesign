import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { hex } from "./sample-deck.js"
import { readText } from "./text.js"
import { textFromMarkdown, textToMarkdown } from "./markdown.js"

const read = (markdown: string) => textFromMarkdown(markdown, "body")

describe("textFromMarkdown", () => {
  it("reads plain words as one paragraph with no spans", () => {
    expect(read("Revenue grew")).toEqual({
      chars: "Revenue grew",
      spans: [],
      paras: [{}],
      style: "body",
      resize: "height",
      alignV: "top",
    })
  })

  it("reads underline and strike on a range of words, and writes them back", () => {
    const markdown = "Say ++under++ and ~~gone~~ now"
    expect(read(markdown)).toMatchObject({
      chars: "Say under and gone now",
      spans: [{ end: 4 }, { end: 9, underline: true }, { end: 14 }, { end: 18, strike: true }, { end: 22 }],
    })
    expect(textToMarkdown(read(markdown))).toBe(markdown)
  })

  it("reads bold, italic, both and a link as end-indexed spans that cover the characters", () => {
    expect(read("a **b** *c* ***d*** [e](https://x.test/y)")).toMatchObject({
      chars: "a b c d e",
      spans: [
        { end: 2 },
        { end: 3, bold: true },
        { end: 4 },
        { end: 5, italic: true },
        { end: 6 },
        { end: 7, bold: true, italic: true },
        { end: 8 },
        { end: 9, link: "https://x.test/y" },
      ],
    })
  })

  it("reads bullets, numbers and two-space indent as paragraph lists with levels", () => {
    const text = read("- one\n  - two\n    - three\n1. first\n2. second")
    expect(text.chars).toBe("one\ntwo\nthree\nfirst\nsecond")
    expect(text.paras).toEqual([
      { list: "bullet" },
      { list: "bullet", level: 1 },
      { list: "bullet", level: 2 },
      { list: "number" },
      { list: "number" },
    ])
  })

  it("keeps the number a list starts at on each of its items, as PowerPoint's startAt", () => {
    expect(read("2. Second risk").paras).toEqual([{ list: "number", startAt: 2 }])
    expect(read("3. a\n9. b").paras).toEqual([
      { list: "number", startAt: 3 },
      { list: "number", startAt: 3 },
    ])
    expect(read("1. a\n5. b").paras).toEqual([{ list: "number" }, { list: "number" }])
    expect(read("1. a\n   4. b").paras).toEqual([{ list: "number" }, { list: "number", level: 1, startAt: 4 }])
  })

  it("keeps a number PowerPoint cannot start a list at as words", () => {
    expect(read("0. zero").chars).toBe("0. zero")
    expect(read("0. zero").paras).toEqual([{}])
    expect(read("32768. far").paras).toEqual([{}])
    expect(read("32767. last").paras).toEqual([{ list: "number", startAt: 32767 }])
  })

  it("makes each line a paragraph and keeps a blank line between paragraphs as an empty one", () => {
    const text = read("one\n\ntwo\nthree\n\n\nfour")
    expect(text.chars).toBe("one\n\ntwo\nthree\n\n\nfour")
    expect(text.paras).toHaveLength(7)
  })

  it("drops blank lines before the first words and after the last", () => {
    const text = read("\n  \none\n\n")
    expect(text.chars).toBe("one")
    expect(text.paras).toEqual([{}])
  })

  it("keeps the gap in an agent's bold lead lines, as the person sees it", () => {
    const text = read("**52 to 40 days**\n\nA 12-day reduction")
    expect(text.chars).toBe("52 to 40 days\n\nA 12-day reduction")
    expect(text.paras).toEqual([{}, {}, {}])
  })

  it("keeps a star with a space beside it, an unmatched marker and an escaped marker as words", () => {
    expect(read("2 * 3 * 4").chars).toBe("2 * 3 * 4")
    expect(read("2 * 3 * 4").spans).toEqual([])
    expect(read("**open").chars).toBe("**open")
    expect(read("a \\*b\\* \\[c\\]").chars).toBe("a *b* [c]")
    expect(read("a \\*b\\* \\[c\\]").spans).toEqual([])
  })

  it("keeps a bracket that is not a link as words", () => {
    expect(read("[not](a link) [open").chars).toBe("[not](a link) [open")
    expect(read("[x]").chars).toBe("[x]")
  })

  it("reads text a doom reader accepts", () => {
    for (const markdown of ["", "a", "- a\n- **b**\n\n1. [c](https://d.example)", "**a***b*", "2. b\n3. c"]) {
      expect(() => readText(JSON.parse(JSON.stringify(read(markdown))))).not.toThrow()
    }
  })

  it("keeps the style the caller names", () => {
    expect(textFromMarkdown("x", "title").style).toBe("title")
  })

  it("caps indent at level 8", () => {
    expect(read(`${" ".repeat(40)}- deep`).paras).toEqual([{ list: "bullet", level: 8 }])
  })
})

describe("textToMarkdown", () => {
  it("writes the words an agent reads: markers, lists and blank lines between paragraphs", () => {
    const markdown = "Lead **bold** *it*\n\n- a\n  - b\n- c\n\n1. x\n2. y\n\nEnd"
    expect(textToMarkdown(read(markdown))).toBe(markdown)
  })

  it("writes each paragraph on its own line and an empty paragraph as a blank line", () => {
    expect(textToMarkdown(read("one\ntwo"))).toBe("one\ntwo")
    expect(textToMarkdown(read("one\n\ntwo"))).toBe("one\n\ntwo")
    expect(textToMarkdown(read("- a\n\nb"))).toBe("- a\n\nb")
  })

  it("reads a loose list, items apart by blank lines, as the same list as a tight one", () => {
    expect(read("- a\n\n- b")).toEqual(read("- a\n- b"))
    expect(read("1. a\n\n2. b\n\n3. c")).toEqual(read("1. a\n2. b\n3. c"))
    expect(textToMarkdown(read("1. a\n\n2. b\n\n3. c"))).toBe("1. a\n2. b\n3. c")
  })

  it("reads a loose nested list as one list, back out to its parent level too", () => {
    expect(read("- a\n\n  - b\n\n- c")).toEqual(read("- a\n  - b\n- c"))
    expect(read("1. a\n\n   - b\n\n2. c").paras).toEqual([
      { list: "number" },
      { list: "bullet", level: 1 },
      { list: "number" },
    ])
  })

  it("keeps a blank line between a list and a paragraph, and between two kinds of list", () => {
    expect(read("- a\n\nAfter").paras).toEqual([{ list: "bullet" }, {}, {}])
    expect(read("Before\n\n- a").paras).toEqual([{}, {}, { list: "bullet" }])
    expect(read("- a\n\n1. b").paras).toEqual([{ list: "bullet" }, {}, { list: "number" }])
  })

  it("counts a list on from its first item's number and starts again after a break", () => {
    expect(textToMarkdown(read("1. a\n1. b\n\nbreak\n\n7. c"))).toBe("1. a\n2. b\n\nbreak\n\n7. c")
    expect(textToMarkdown(read("2. Second risk"))).toBe("2. Second risk")
    expect(textToMarkdown(read("3. a\n3. b\n  - c\n3. d"))).toBe("3. a\n4. b\n  - c\n5. d")
  })

  it("escapes what would read as a marker", () => {
    for (const words of [
      "5 * 3",
      "[x](y)",
      "back\\slash",
      "- not a bullet",
      "1. not a number",
      " leading space",
      "a+b",
      "a~b",
    ]) {
      const text = { ...read("x"), chars: words, paras: [{}] }
      expect(textFromMarkdown(textToMarkdown(text), "body").chars).toBe(words)
    }
  })

  it("moves the spaces at the edge of a styled run outside its markers", () => {
    const text = { ...read("a b"), chars: "a b c", spans: [{ end: 1 }, { end: 3, bold: true }, { end: 5 }] }
    expect(textToMarkdown(text)).toBe("a **b** c")
  })

  it("leaves out what markdown cannot hold: colours, sizes and fonts", () => {
    const text = { ...read("ab"), spans: [{ end: 2, color: hex(0xff0000), size: 90 }] }
    expect(textToMarkdown(text)).toBe("ab")
  })
})

const letters = fc.constantFrom(..."ab c-.1*[]()\\é".split(""))
const word = fc.string({ unit: letters, minLength: 1, maxLength: 6 })
const edgeless = word.filter((chars) => chars === chars.trim())
const address = fc.string({ unit: fc.constantFrom(..."ab:/.()\\-".split("")), minLength: 1, maxLength: 8 })

const run = fc.oneof(
  word.map((text) => ({ text })),
  fc.record({ text: edgeless, bold: fc.constant(true) }),
  fc.record({ text: edgeless, italic: fc.constant(true) }),
  fc.record({ text: edgeless, bold: fc.constant(true), italic: fc.constant(true) }),
  fc.record({ text: edgeless, link: address }),
)
const paragraph = fc.record({
  runs: fc.oneof(fc.array(run, { minLength: 1, maxLength: 4 }), fc.constant([])),
  list: fc.constantFrom(undefined, "bullet" as const, "number" as const),
  level: fc.integer({ min: 0, max: 3 }),
})

type Format = { bold?: true | undefined; italic?: true | undefined; link?: string | undefined }
type Paragraph = {
  runs: readonly ({ text: string } & Format)[]
  list?: "bullet" | "number" | undefined
  level: number
}

const textOfParagraphs = (paragraphs: readonly Paragraph[]) => {
  const chars = paragraphs.map(({ runs }) => runs.map(({ text }) => text).join("")).join("\n")
  const formats: Format[] = []
  paragraphs.forEach(({ runs }, at) => {
    for (const { text, bold, italic, link } of runs)
      for (let char = 0; char < text.length; char += 1) formats.push({ bold, italic, link })
    if (at < paragraphs.length - 1) formats.push({})
  })
  const spans: Record<string, unknown>[] = []
  formats.forEach((format, at) => {
    const same = (other: Record<string, unknown>) =>
      other.bold === format.bold && other.italic === format.italic && other.link === format.link
    const last = spans[spans.length - 1]
    if (last !== undefined && same(last)) last.end = at + 1
    else
      spans.push({
        end: at + 1,
        ...(format.bold ? { bold: true } : {}),
        ...(format.italic ? { italic: true } : {}),
        ...(format.link === undefined ? {} : { link: format.link }),
      })
  })
  const plain = spans.every((span) => Object.keys(span).length === 1)
  return {
    chars,
    spans: plain ? [] : spans,
    paras: paragraphs.map(({ list, level }) => (list === undefined ? {} : { list, ...(level === 0 ? {} : { level }) })),
    style: "body" as const,
    resize: "height" as const,
    alignV: "top" as const,
  }
}

describe("markdown round trip", () => {
  it("gives back the same text for any paragraphs of plain, bold, italic and linked words, and empty ones between", () => {
    fc.assert(
      fc.property(fc.array(paragraph, { minLength: 1, maxLength: 4 }), (drawn) => {
        const paragraphs: readonly Paragraph[] = drawn.map((each) =>
          each.runs.length === 0 ? { runs: [], level: 0 } : each,
        )
        fc.pre(paragraphs[0]!.runs.length > 0 && paragraphs.at(-1)!.runs.length > 0)
        const filled = paragraphs.filter((each) => each.runs.length > 0)
        fc.pre(
          filled.every(
            (each, at) =>
              at === 0 ||
              each.list === undefined ||
              filled[at - 1]!.list === undefined ||
              paragraphs.indexOf(each) === paragraphs.indexOf(filled[at - 1]!) + 1,
          ),
        )
        const text = textOfParagraphs(paragraphs)
        const markdown = textToMarkdown(text as never)
        expect(textFromMarkdown(markdown, "body")).toEqual(text)
        expect(textToMarkdown(textFromMarkdown(markdown, "body"))).toBe(markdown)
      }),
    )
  })
})

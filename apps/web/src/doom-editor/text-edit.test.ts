import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import {
  graphemeAfter,
  graphemeBefore,
  markOn,
  replaceRange,
  toggleMark,
  toggledList,
  withParagraphs,
  wordAfter,
  wordBefore,
} from "./text-edit"

const plain = (chars: string): doom.Text => doom.textFromMarkdown(chars, "body")
function valid(text: doom.Text): doom.Text {
  expect(text.paras).toHaveLength(text.chars.split("\n").length)
  let at = 0
  for (const span of text.spans) {
    expect(span.end).toBeGreaterThan(at)
    at = span.end
  }
  if (text.spans.length > 0) expect(at).toBe(text.chars.length)
  expect(doom.isRefusal(doom.props.text.read(text))).toBe(false)
  return text
}

describe("replaceRange", () => {
  it("types into plain text and into the middle of it", () => {
    expect(valid(replaceRange(plain("Hello"), 5, 5, "!")).chars).toBe("Hello!")
    expect(valid(replaceRange(plain("Helo"), 2, 2, "l")).chars).toBe("Hello")
  })

  it("deletes and replaces a range", () => {
    expect(valid(replaceRange(plain("Hello world"), 5, 11, "")).chars).toBe("Hello")
    expect(valid(replaceRange(plain("Hello world"), 6, 11, "there")).chars).toBe("Hello there")
  })

  it("gives typed characters the style of the character before them", () => {
    const bold = toggleMark(plain("Hello"), 0, 5, "bold")
    const typed = valid(replaceRange(bold, 5, 5, "!"))
    expect(typed.spans).toEqual([{ end: 6, bold: true }])
  })

  it("gives words typed over a selection the style of its first character", () => {
    const styled = toggleMark(plain("Hello world"), 6, 11, "bold")
    const typed = valid(replaceRange(styled, 6, 11, "all"))
    expect(typed.chars).toBe("Hello all")
    expect(typed.spans).toEqual([{ end: 6 }, { end: 9, bold: true }])
  })

  it("uses the style it is given for new characters", () => {
    const typed = valid(replaceRange(plain("ab"), 2, 2, "c", { italic: true }))
    expect(typed.spans).toEqual([{ end: 2 }, { end: 3, italic: true }])
  })

  it("splits a paragraph on a new line and copies its settings, and joins two when the break goes", () => {
    const list = { ...plain("one"), paras: [{ list: "bullet" as const }] }
    const split = valid(replaceRange(list, 3, 3, "\ntwo"))
    expect(split.paras).toEqual([{ list: "bullet" }, { list: "bullet" }])
    const joined = valid(replaceRange(split, 3, 4, ""))
    expect(joined.chars).toBe("onetwo")
    expect(joined.paras).toEqual([{ list: "bullet" }])
  })

  it("works at the ends and on empty text", () => {
    expect(valid(replaceRange(plain(""), 0, 0, "x")).chars).toBe("x")
    expect(valid(replaceRange(plain("x"), 0, 1, "")).chars).toBe("")
    expect(valid(replaceRange(plain("ab"), 0, 0, "z")).chars).toBe("zab")
  })
})

describe("marks", () => {
  it("turns a mark on for a range and off again when the whole range has it", () => {
    const on = valid(toggleMark(plain("Hello world"), 0, 5, "bold"))
    expect(on.spans).toEqual([{ end: 5, bold: true }, { end: 11 }])
    expect(markOn(on, 0, 5, "bold")).toBe(true)
    expect(markOn(on, 0, 11, "bold")).toBe(false)
    const off = valid(toggleMark(on, 0, 5, "bold"))
    expect(off.spans).toEqual([])
  })

  it("adds to the rest when only part of the range has the mark", () => {
    const part = toggleMark(plain("Hello world"), 0, 5, "bold")
    expect(valid(toggleMark(part, 0, 11, "bold")).spans).toEqual([{ end: 11, bold: true }])
  })

  it("combines marks in one span", () => {
    const both = toggleMark(toggleMark(plain("Hello"), 0, 5, "bold"), 0, 5, "italic")
    expect(both.spans).toEqual([{ end: 5, bold: true, italic: true }])
  })

  it("leaves a collapsed range alone", () => {
    const text = plain("Hello")
    expect(toggleMark(text, 2, 2, "bold")).toBe(text)
  })
})

describe("paragraphs", () => {
  it("changes only the paragraphs the range touches", () => {
    const text = valid(replaceRange(plain("a"), 1, 1, "\nb\nc"))
    const centred = withParagraphs(text, 2, 3, (para) => ({ ...para, align: "center" }))
    expect(centred.paras).toEqual([{}, { align: "center" }, {}])
  })

  it("turns a list on for every touched paragraph and off when all have it", () => {
    const text = replaceRange(plain("a"), 1, 1, "\nb")
    const on = toggledList(text, 0, 3, "bullet")
    expect(on.paras).toEqual([{ list: "bullet" }, { list: "bullet" }])
    expect(toggledList(on, 0, 3, "bullet").paras).toEqual([{}, {}])
    expect(toggledList(on, 0, 3, "number").paras).toEqual([{ list: "number" }, { list: "number" }])
  })
})

describe("moving over characters", () => {
  it("steps over a surrogate pair as one character", () => {
    const chars = "a😀b"
    expect(graphemeAfter(chars, 1)).toBe(3)
    expect(graphemeBefore(chars, 3)).toBe(1)
    expect(graphemeBefore(chars, 0)).toBe(0)
    expect(graphemeAfter(chars, 4)).toBe(4)
  })

  it("steps by word", () => {
    const chars = "one two  three"
    expect(wordBefore(chars, 7)).toBe(4)
    expect(wordBefore(chars, 4)).toBe(0)
    expect(wordAfter(chars, 0)).toBe(3)
    expect(wordAfter(chars, 3)).toBe(7)
    expect(wordAfter(chars, 14)).toBe(14)
  })
})

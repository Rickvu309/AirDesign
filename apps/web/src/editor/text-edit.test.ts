import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import {
  graphemeAfter,
  graphemeBefore,
  insertSlice,
  linkedWords,
  linkWords,
  baseOf,
  markOn,
  replaceRange,
  sliceText,
  toggleMark,
  withMark,
  toggledList,
  withParagraphs,
  wordAfter,
  wordBefore,
} from "./text-edit"

const regular = { font: "Inter", weight: 400 }
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
    const bold = toggleMark(plain("Hello"), 0, 5, "bold", regular)
    const typed = valid(replaceRange(bold, 5, 5, "!"))
    expect(typed.spans).toEqual([{ end: 6, bold: true }])
  })

  it("gives words typed over a selection the style of its first character", () => {
    const styled = toggleMark(plain("Hello world"), 6, 11, "bold", regular)
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
    const on = valid(toggleMark(plain("Hello world"), 0, 5, "bold", regular))
    expect(on.spans).toEqual([{ end: 5, bold: true }, { end: 11 }])
    expect(markOn(on, 0, 5, "bold", regular)).toBe(true)
    expect(markOn(on, 0, 11, "bold", regular)).toBe(false)
    const off = valid(toggleMark(on, 0, 5, "bold", regular))
    expect(off.spans).toEqual([])
  })

  it("adds to the rest when only part of the range has the mark", () => {
    const part = toggleMark(plain("Hello world"), 0, 5, "bold", regular)
    expect(valid(toggleMark(part, 0, 11, "bold", regular)).spans).toEqual([{ end: 11, bold: true }])
  })

  it("combines marks in one span", () => {
    const both = toggleMark(toggleMark(plain("Hello"), 0, 5, "bold", regular), 0, 5, "italic", regular)
    expect(both.spans).toEqual([{ end: 5, bold: true, italic: true }])
  })

  it("leaves a collapsed range alone", () => {
    const text = plain("Hello")
    expect(toggleMark(text, 2, 2, "bold", regular)).toBe(text)
  })
})

describe("linked words", () => {
  const linked = () => doom.textFromMarkdown("Read the **[full report](https://a.example)** now", "body")
  const report = { from: 9, to: 20, link: "https://a.example" }

  it("finds the whole linked phrase the caret is in, across a change of look inside it", () => {
    const text = {
      ...linked(),
      spans: [
        { end: 9 },
        { end: 14, link: "https://a.example" },
        { end: 20, link: "https://a.example", bold: true },
        { end: 24 },
      ],
    }
    expect(linkedWords(text, 12, 12)).toEqual({ ...report, mixed: false })
    expect(linkedWords(text, 20, 20)).toEqual({ ...report, mixed: false })
    expect(linkedWords(text, 3, 3)).toBeNull()
    expect(linkedWords(text, 9, 9)).toBeNull()
    const leading = doom.textFromMarkdown("[Home](https://a.example) page", "body")
    expect(linkedWords(leading, 0, 0)).toBeNull()
    expect(linkedWords(leading, 1, 1)).toEqual({ from: 0, to: 4, link: "https://a.example", mixed: false })
  })

  it("marks a selection mixed when its words hold different links or mix linked and plain words", () => {
    const two = doom.textFromMarkdown("[One](https://a.example) and [two](https://b.example)", "body")
    expect(linkedWords(linked(), 10, 14)).toEqual({ from: 10, to: 14, link: "https://a.example", mixed: false })
    expect(linkedWords(linked(), 14, 10)).toEqual({ from: 10, to: 14, link: "https://a.example", mixed: false })
    expect(linkedWords(linked(), 0, 4)).toEqual({ from: 0, to: 4, link: undefined, mixed: false })
    expect(linkedWords(plain("Read the site"), 0, 4)).toEqual({ from: 0, to: 4, link: undefined, mixed: false })
    expect(linkedWords(linked(), 2, 14)).toEqual({ from: 2, to: 14, link: undefined, mixed: true })
    expect(linkedWords(two, 0, 12)).toEqual({ from: 0, to: 12, link: undefined, mixed: true })
    const adjacent = {
      ...plain("OneTwo"),
      spans: [
        { end: 3, link: "https://a.example" },
        { end: 6, link: "https://b.example" },
      ],
    }
    expect(linkedWords(adjacent, 0, 6)).toEqual({ from: 0, to: 6, link: undefined, mixed: true })
  })

  it("changes or removes the link on those words and keeps their other looks", () => {
    const changed = valid(linkWords(linked(), report.from, report.to, "https://b.example"))
    expect(linkedWords(changed, 12, 12)).toEqual({ ...report, link: "https://b.example", mixed: false })
    expect(markOn(changed, 9, 20, "bold", regular)).toBe(true)
    const removed = valid(linkWords(linked(), report.from, report.to, null))
    expect(linkedWords(removed, 12, 12)).toBeNull()
    expect(markOn(removed, 9, 20, "bold", regular)).toBe(true)
    const added = valid(linkWords(plain("Read the report"), 9, 15, "https://c.example"))
    expect(linkedWords(added, 11, 11)).toEqual({ from: 9, to: 15, link: "https://c.example", mixed: false })
  })

  it("slices and inserts linked words with their formatting intact", () => {
    const copied = sliceText(linked(), 9, 20)
    expect(copied.chars).toBe("full report")
    expect(copied.spans).toEqual([{ end: 11, bold: true, link: "https://a.example" }])
    const pasted = valid(insertSlice(plain("See  here"), 4, 4, copied))
    expect(pasted.chars).toBe("See full report here")
    expect(pasted.spans).toEqual([{ end: 4 }, { end: 15, bold: true, link: "https://a.example" }, { end: 20 }])

    const merged = valid(insertSlice(linked(), 20, 20, sliceText(linked(), 14, 20)))
    expect(merged.chars).toBe("Read the full reportreport now")
    expect(merged.spans).toEqual([{ end: 9 }, { end: 26, bold: true, link: "https://a.example" }, { end: 30 }])

    const multi = doom.textFromMarkdown("**[full report](https://a.example)**\nSecond", "body")
    const twoLines = sliceText(multi, 0, multi.chars.length)
    const intoBullet = valid(insertSlice({ ...plain("Item: "), paras: [{ list: "bullet" }] }, 6, 6, twoLines))
    expect(intoBullet.chars).toBe("Item: full report\nSecond")
    expect(intoBullet.paras).toEqual([{ list: "bullet" }, {}])
    expect(intoBullet.spans).toEqual([{ end: 6 }, { end: 17, bold: true, link: "https://a.example" }, { end: 24 }])
  })

  it("extends a link when typing just after its last letter, and stays plain before its first", () => {
    const extended = valid(replaceRange(linked(), 20, 20, "s"))
    expect(extended.chars).toBe("Read the full reports now")
    expect(extended.spans).toEqual([{ end: 9 }, { end: 21, bold: true, link: "https://a.example" }, { end: 25 }])

    const atEnd = doom.textFromMarkdown("Read [site](https://a.example)", "body")
    const extendedEnd = valid(replaceRange(atEnd, 9, 9, "s"))
    expect(extendedEnd.chars).toBe("Read sites")
    expect(extendedEnd.spans).toEqual([{ end: 5 }, { end: 10, link: "https://a.example" }])

    const before = valid(replaceRange(linked(), 9, 9, "new "))
    expect(before.chars).toBe("Read the new full report now")
    expect(before.spans).toEqual([{ end: 13 }, { end: 24, bold: true, link: "https://a.example" }, { end: 28 }])
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

describe("bold as the canvas paints it", () => {
  const theme = (weight: number, fonts = { heading: "Inter", body: "Inter" }): doom.Theme => {
    const base = doom.defaultTheme
    const label = { ...base.textStyles.label, weight }
    return { ...base, fonts, textStyles: { ...base.textStyles, label } }
  }
  const labelText = (spans: doom.Text["spans"] = []): doom.Text => ({ ...plain("Hello"), style: "label", spans })
  const painted = (text: doom.Text, shown: doom.Theme) => {
    const style = shown.textStyles[text.style]
    return doom.paintedFace(shown.fonts[style.font], style.weight, text.spans[0]?.bold).bold
  }

  it("reads a style weight of 600 on a plain family as Bold, and turns it off by writing bold:false", () => {
    const shown = theme(600)
    const base = baseOf(labelText(), shown)
    const text = labelText()
    expect(painted(text, shown)).toBe(true)
    expect(markOn(text, 0, 5, "bold", base)).toBe(true)
    const off = valid(toggleMark(text, 0, 5, "bold", base))
    expect(off.spans).toEqual([{ end: 5, bold: false }])
    expect(painted(off, shown)).toBe(false)
    expect(markOn(off, 0, 5, "bold", base)).toBe(false)
    const back = valid(toggleMark(off, 0, 5, "bold", base))
    expect(back.spans).toEqual([{ end: 5, bold: true }])
    expect(painted(back, shown)).toBe(true)
  })

  it("flips a Bold heading to Regular and back, in step with the paint", () => {
    const shown = theme(600, { heading: "Inter SemiBold", body: "Inter" })
    const base = baseOf({ ...labelText(), style: "heading" }, shown)
    const bold = { ...labelText([{ end: 5, bold: true }]), style: "heading" as const }
    expect(markOn(bold, 0, 5, "bold", base)).toBe(true)
    const released = valid(toggleMark(bold, 0, 5, "bold", base))
    expect(released.spans).toEqual([])
    expect(markOn(released, 0, 5, "bold", base)).toBe(false)
    expect(painted(released, shown)).toBe(false)
  })

  it("keeps a plain-family Bold heading lit until it is turned off, and Regular after", () => {
    const shown = theme(700)
    const base = baseOf(labelText(), shown)
    const bold = labelText([{ end: 5, bold: true }])
    expect(markOn(bold, 0, 5, "bold", base)).toBe(true)
    const off = valid(toggleMark(bold, 0, 5, "bold", base))
    expect(off.spans).toEqual([{ end: 5, bold: false }])
    expect(markOn(off, 0, 5, "bold", base)).toBe(false)
    expect(painted(off, shown)).toBe(false)
    expect(withMark({ bold: true }, "bold", false, base)).toEqual({ bold: false })
    expect(withMark({ bold: true }, "bold", false, regular)).toEqual({})
  })
})

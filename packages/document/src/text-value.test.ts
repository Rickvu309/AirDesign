import { describe, expect, it } from "vitest"
import { readTextValue, writeTextValue } from "./text-value.js"

describe("readTextValue", () => {
  it("refuses a string that is not JSON", () => {
    expect(readTextValue("{")).toBeNull()
  })

  it("refuses a value that is not an array", () => {
    expect(readTextValue('{"from":0,"runs":[]}')).toBeNull()
  })

  it("refuses an empty list", () => {
    expect(readTextValue("[]")).toBeNull()
  })

  it("refuses a paragraph from of -1", () => {
    expect(readTextValue('[{"from":-1,"runs":[]}]')).toBeNull()
  })

  it("refuses a run from of -2", () => {
    expect(readTextValue('[{"from":0,"runs":[{"from":-2,"text":"a"}]}]')).toBeNull()
  })

  it("refuses a from of 1.5", () => {
    expect(readTextValue('[{"from":1.5,"runs":[]}]')).toBeNull()
  })

  it("refuses a text that is a number", () => {
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":1}]}]')).toBeNull()
  })

  it("refuses an unknown key", () => {
    expect(readTextValue('[{"from":0,"runs":[],"kind":"p"}]')).toBeNull()
  })

  it("refuses a missing runs", () => {
    expect(readTextValue('[{"from":0}]')).toBeNull()
  })

  it("reads a from of -0 as 0", () => {
    const read = readTextValue('[{"from":-0,"runs":[{"from":-0,"text":"a"}]}]')
    expect(read).toEqual([{ from: 0, runs: [{ from: 0, text: "a" }] }])
    expect(Object.is(read?.[0]?.from, 0)).toBe(true)
    expect(Object.is(read?.[0]?.runs[0]?.from, 0)).toBe(true)
  })
})

describe("writeTextValue", () => {
  it("writes from before runs and from before text", () => {
    expect(writeTextValue([{ from: 0, runs: [{ from: -1, text: "a" }] }])).toBe(
      '[{"from":0,"runs":[{"from":-1,"text":"a"}]}]',
    )
  })
})

describe("run formats", () => {
  it("reads bold, italic and underline on a run", () => {
    expect(
      readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","bold":true,"italic":false,"underline":true}]}]'),
    ).toEqual([{ from: 0, runs: [{ from: 0, text: "a", bold: true, italic: false, underline: true }] }])
  })

  it("refuses a format that is not true or false", () => {
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","bold":1}]}]')).toBeNull()
  })

  it("refuses an unknown run key beside a format", () => {
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","bold":true,"weight":1}]}]')).toBeNull()
  })

  it("writes a format after text and leaves out a format the run lacks", () => {
    expect(writeTextValue([{ from: 0, runs: [{ from: 0, text: "a", underline: false, bold: true }] }])).toBe(
      '[{"from":0,"runs":[{"from":0,"text":"a","bold":true,"underline":false}]}]',
    )
  })

  it("reads a value an older client wrote with no formats", () => {
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a"}]}]')).toEqual([
      { from: 0, runs: [{ from: 0, text: "a" }] },
    ])
  })
})

describe("size, colour, alignment and bullets", () => {
  it("reads a size, a scheme colour, alignment and bullets", () => {
    expect(
      readTextValue(
        '[{"from":0,"align":"center","bullet":true,"runs":[{"from":0,"text":"a","size":1800,"color":{"scheme":"accent1"}}]}]',
      ),
    ).toEqual([
      {
        from: 0,
        align: "center",
        list: "bullets",
        runs: [{ from: 0, text: "a", size: 1800, color: { scheme: "accent1" } }],
      },
    ])
  })

  it("reads an rgb colour", () => {
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","color":{"rgb":"FF00AA"}}]}]')).toEqual([
      { from: 0, runs: [{ from: 0, text: "a", color: { rgb: "FF00AA" } }] },
    ])
  })

  it("writes size after the formats and colour after size, and alignment before bullets", () => {
    expect(
      writeTextValue([
        {
          from: 0,
          list: "none",
          align: "right",
          runs: [{ from: 0, text: "a", color: { rgb: "00FF00" }, size: 2400, bold: true }],
        },
      ]),
    ).toBe(
      '[{"from":0,"align":"right","list":"none","runs":[{"from":0,"text":"a","bold":true,"size":2400,"color":{"rgb":"00FF00"}}]}]',
    )
  })

  it("refuses a size below 100, above 400000, or not an integer", () => {
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","size":12}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","size":99}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","size":400001}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","size":"1800"}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","size":1800.5}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","size":100}]}]')).toEqual([
      { from: 0, runs: [{ from: 0, text: "a", size: 100 }] },
    ])
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","size":400000}]}]')).toEqual([
      { from: 0, runs: [{ from: 0, text: "a", size: 400000 }] },
    ])
  })

  it("reads a mapped slot and a colour's transforms", () => {
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","color":{"scheme":"tx1"}}]}]')).toEqual([
      { from: 0, runs: [{ from: 0, text: "a", color: { scheme: "tx1" } }] },
    ])
    const darker = '{"scheme":"accent1","transforms":[{"op":"lumMod","val":75000}]}'
    const stored = `[{"from":0,"runs":[{"from":0,"text":"a","color":${darker}}]}]`
    const read = readTextValue(stored)
    expect(read).toEqual([
      {
        from: 0,
        runs: [{ from: 0, text: "a", color: { scheme: "accent1", transforms: [{ op: "lumMod", val: 75000 }] } }],
      },
    ])
    expect(read === null ? null : writeTextValue(read)).toBe(stored)
  })

  it("refuses a bad colour", () => {
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","color":1}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","color":{"scheme":"phClr"}}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","color":{"rgb":"ff0000"}}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","color":{"rgb":"FF00"}}]}]')).toBeNull()
    expect(
      readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","color":{"scheme":"dk1","rgb":"000000"}}]}]'),
    ).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","color":{"scheme":"dk1","extra":1}}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","color":{}}]}]')).toBeNull()
  })

  it("refuses a bad alignment or bullet", () => {
    expect(readTextValue('[{"from":0,"align":"distributed","runs":[{"from":0,"text":"a"}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"align":"justify","runs":[{"from":0,"text":"a"}]}]')).toEqual([
      { from: 0, align: "justify", runs: [{ from: 0, text: "a" }] },
    ])
    expect(readTextValue('[{"from":0,"bullet":"yes","runs":[{"from":0,"text":"a"}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"align":"left","runs":[{"from":0,"text":"a"}]}]')).toEqual([
      { from: 0, align: "left", runs: [{ from: 0, text: "a" }] },
    ])
  })

  it("keeps a run's letter case and refuses one Figma does not offer", () => {
    for (const letters of ["none", "upper", "lower", "title", "small"])
      expect(readTextValue(`[{"from":0,"runs":[{"from":0,"text":"a","case":"${letters}"}]}]`)).toEqual([
        { from: 0, runs: [{ from: 0, text: "a", case: letters }] },
      ])
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","case":"shout"}]}]')).toBeNull()
    const kept = readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","case":"small"}]}]')
    expect(kept === null ? "" : writeTextValue(kept)).toBe('[{"from":0,"runs":[{"from":0,"text":"a","case":"small"}]}]')
  })

  it("keeps a run's font face and a paragraph's line and paragraph spacing, and refuses ones it cannot write", () => {
    const stored =
      '[{"from":0,"lineHeight":150000,"spaceBefore":600,"spaceAfter":0,"runs":[{"from":0,"text":"a","font":"Georgia"}]}]'
    const read = readTextValue(stored)
    expect(read).toEqual([
      {
        from: 0,
        lineHeight: 150_000,
        spaceBefore: 600,
        spaceAfter: 0,
        runs: [{ from: 0, text: "a", font: "Georgia" }],
      },
    ])
    expect(read === null ? null : writeTextValue(read)).toBe(stored)
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","font":""}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"runs":[{"from":0,"text":"a","font":7}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"lineHeight":0,"runs":[{"from":0,"text":"a"}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"spaceBefore":-1,"runs":[{"from":0,"text":"a"}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"spaceAfter":1.5,"runs":[{"from":0,"text":"a"}]}]')).toBeNull()
  })
})

for (const fields of [{ strike: true }, { letterSpacing: -64 }]) {
  it(`stores the run fields ${JSON.stringify(fields)}`, () => {
    const value = [{ from: 0, runs: [{ from: 0, text: "Text", ...fields }] }]
    expect(readTextValue(JSON.stringify(value))).toEqual(value)
  })
}

it("stores a single list choice and reads an older bullet flag", () => {
  for (const list of ["none", "bullets", "numbers"]) {
    const value = [{ from: 0, list, runs: [{ from: 0, text: "Item" }] }]
    expect(readTextValue(JSON.stringify(value))).toEqual(value)
  }
  expect(readTextValue('[{"from":0,"bullet":true,"runs":[]}]')).toEqual([{ from: 0, list: "bullets", runs: [] }])
  expect(readTextValue('[{"from":0,"list":"numbers","bullet":true,"runs":[]}]')).toBeNull()
})

it("refuses invalid letter spacing and list choices", () => {
  for (const letterSpacing of [-400001, 400001, 0.5, "1"]) {
    expect(readTextValue(JSON.stringify([{ from: 0, runs: [{ from: 0, text: "a", letterSpacing }] }]))).toBeNull()
  }
  for (const list of [true, "both", 1]) {
    expect(readTextValue(JSON.stringify([{ from: 0, list, runs: [] }]))).toBeNull()
  }
})

describe("a paragraph a build stored before line height had its name", () => {
  const typed = '[{"from":0,"lineSpacing":150000,"runs":[{"from":-1,"text":"Quarterly plan"}]}]'

  it("reads its line height and writes it under today's name", () => {
    const read = readTextValue(typed)
    expect(read).toEqual([{ from: 0, lineHeight: 150_000, runs: [{ from: -1, text: "Quarterly plan" }] }])
    expect(read === null ? null : writeTextValue(read)).toBe(
      '[{"from":0,"lineHeight":150000,"runs":[{"from":-1,"text":"Quarterly plan"}]}]',
    )
  })

  it("reads a styled paragraph with the older spacing key", () => {
    const styled =
      '[{"from":0,"align":"center","lineSpacing":130000,"spaceBefore":0,"spaceAfter":0,"runs":[{"from":-1,"text":"North, South and West","size":2400}]}]'
    expect(readTextValue(styled)?.[0]).toMatchObject({ align: "center", lineHeight: 130_000, spaceBefore: 0 })
  })

  it("is not structured text when one paragraph holds both names", () => {
    expect(
      readTextValue('[{"from":0,"lineSpacing":150000,"lineHeight":120000,"runs":[{"from":0,"text":"a"}]}]'),
    ).toBeNull()
  })

  it("leaves a plain string that only looks like JSON as plain text", () => {
    expect(readTextValue('[{"from":0,"lineSpacing":120000}]')).toBeNull()
    expect(readTextValue('{"lineSpacing":120000,"runs":[]}')).toBeNull()
  })
})

it("stores a list level from 0 to 8, PowerPoint's lvl, and refuses any other", () => {
  for (const level of [0, 4, 8]) {
    const written = writeTextValue([{ from: 0, list: "bullets", level, runs: [{ from: 0, text: "Item" }] }])
    expect(written).toBe(`[{"from":0,"list":"bullets","level":${level},"runs":[{"from":0,"text":"Item"}]}]`)
    expect(readTextValue(written)?.[0]?.level).toBe(level)
  }
  for (const level of [-1, 9, 1.5, "1"])
    expect(readTextValue(JSON.stringify([{ from: 0, level, runs: [] }]))).toBeNull()
})

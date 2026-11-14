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
        bullet: true,
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
          bullet: false,
          align: "right",
          runs: [{ from: 0, text: "a", color: { rgb: "00FF00" }, size: 2400, bold: true }],
        },
      ]),
    ).toBe(
      '[{"from":0,"align":"right","bullet":false,"runs":[{"from":0,"text":"a","bold":true,"size":2400,"color":{"rgb":"00FF00"}}]}]',
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
    expect(readTextValue('[{"from":0,"align":"justify","runs":[{"from":0,"text":"a"}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"bullet":"yes","runs":[{"from":0,"text":"a"}]}]')).toBeNull()
    expect(readTextValue('[{"from":0,"align":"left","runs":[{"from":0,"text":"a"}]}]')).toEqual([
      { from: 0, align: "left", runs: [{ from: 0, text: "a" }] },
    ])
  })
})

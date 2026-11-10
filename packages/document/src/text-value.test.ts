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

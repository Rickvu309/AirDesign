import { describe, expect, it } from "vitest"
import { readTextValue } from "./text-value.js"

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
})

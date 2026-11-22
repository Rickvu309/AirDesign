import { describe, expect, it } from "vitest"
import { readTabbed } from "./index.js"

describe("tab-separated cells", () => {
  it("reads rows and cells, drops the last line break and pads short rows", () => {
    expect(readTabbed("Region\tSales\r\nNorth\t12\nSouth\n")).toEqual([
      ["Region", "Sales"],
      ["North", "12"],
      ["South", ""],
    ])
  })

  it("reads a quoted cell that holds a line break, a tab or a doubled quote", () => {
    expect(readTabbed('"two\nlines"\t"a\tb"\t"say ""hi"""\tplain "x"')).toEqual([
      ["two\nlines", "a\tb", 'say "hi"', 'plain "x"'],
    ])
  })
})

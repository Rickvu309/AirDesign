import { describe, expect, it } from "vitest"
import { rankAll } from "./sheet.mjs"

const row = (name, findings) => ({ name, look: { report: { findings } } })
const finding = (number, rank) => ({
  number,
  rank,
  detector: "d",
  selector: "s",
  box: {},
  message: "m",
  more: 0,
  crop: "c",
})

describe("rankAll", () => {
  it("lists every state's findings worst first and skips states not reached", () => {
    const ranked = rankAll([
      row("b", [finding(1, 2)]),
      row("a", [finding(1, 2), finding(2, 1)]),
      { name: "c", error: "not reached" },
    ])
    expect(ranked.map((each) => `${each.state}${each.number}`)).toEqual(["a2", "a1", "b1"])
  })
})

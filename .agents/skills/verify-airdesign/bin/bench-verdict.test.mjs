import { describe, expect, it } from "vitest"
import { benchTable, schedule, summary, verdict } from "./bench-verdict.mjs"

const main = summary([182, 176, 190, 185, 179, 201, 183])

describe("verdict", () => {
  it("a branch slower by more than both spreads and 5 % is slower", () => {
    const branch = summary([214, 205, 222, 210, 219, 230, 214])
    expect(main).toMatchObject({ median: 183, spread: [180.5, 187.5] })
    expect(verdict(main, branch)).toEqual({ verdict: "slower", by: 31, share: 0.169 })
  })

  it("a difference inside the spread is not shown", () => {
    const noisy = summary([150, 260, 190, 240, 170, 200, 230])
    expect(verdict(main, noisy).verdict).toBe("no difference shown")
  })

  it("a gap past the spreads but under 5 % of main's median is not shown", () => {
    const steady = summary([100, 100, 100, 100, 100])
    expect(verdict(steady, summary([104, 104, 104, 104, 104])).verdict).toBe("no difference shown")
    expect(verdict(steady, summary([106, 106, 106, 106, 106])).verdict).toBe("slower")
  })

  it("a branch faster under the mirror rule is faster", () => {
    expect(verdict(main, summary([150, 152, 149, 151, 150, 153, 148])).verdict).toBe("faster")
  })
})

describe("schedule", () => {
  it("interleaving alternates sides within each run of every case", () => {
    const slots = schedule(["add-text", "drag"], 2)
    expect(slots.map((slot) => `${String(slot.run)} ${slot.case} ${slot.side}`)).toEqual([
      "1 add-text main",
      "1 add-text branch",
      "1 drag main",
      "1 drag branch",
      "2 add-text main",
      "2 add-text branch",
      "2 drag main",
      "2 drag branch",
    ])
  })
})

describe("benchTable", () => {
  it("widens the case column to the longest case name", () => {
    const row = { case: "import-nasa-8ft-tunnel", main, branch: main, ...verdict(main, main) }
    const table = benchTable({
      base: "a",
      head: "b",
      throttle: 4,
      runs: 7,
      rows: [row],
      load: { max: 2, cores: 16, above: 0 },
    })
    expect(table.split("\n")[2]).toMatch(/^import-nasa-8ft-tunnel {3}183 ms/)
    expect(table.split("\n").at(-1)).toBe("load max 2 on 16 cores")
  })

  it("prints each case in its own unit with the verdict and the load", () => {
    const rows = [
      { case: "add-text", main, branch: summary([214, 205, 222, 210, 219, 230, 214]) },
      { case: "drag", main: summary([16.9, 16.7, 17.4]), branch: summary([16.8, 16.6, 17.2]) },
      { case: "open-41", main: summary([2410, 2330, 2520]), branch: summary([2390, 2300, 2470]) },
    ].map((row) => ({ ...row, ...verdict(row.main, row.branch) }))
    const table = benchTable({
      base: "2c036f24aa",
      head: "1a2b3c4dbb",
      throttle: 4,
      runs: 7,
      rows,
      load: { max: 27.1, cores: 16, above: 2 },
    })
    expect(table).toEqual(
      [
        "bench 2c036f24 (main) vs 1a2b3c4d, CPU throttle 4, 7 runs a side, interleaved",
        "case       main median [IQR]    branch median [IQR]  verdict",
        "add-text   183 ms [181-188]     214 ms [212-221]     slower by 31 ms (17 %)",
        "drag       16.9 ms [16.8-17.1]  16.8 ms [16.7-17.0]  no difference shown",
        "open-41    2.41 s [2.37-2.46]   2.39 s [2.35-2.43]   no difference shown",
        "load max 27.1 on 16 cores (2 runs above the core count)",
      ].join("\n"),
    )
  })
})

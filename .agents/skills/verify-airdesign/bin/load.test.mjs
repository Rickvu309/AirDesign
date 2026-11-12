import { describe, expect, it } from "vitest"
import { load, loadLine } from "./load.mjs"

describe("loadLine", () => {
  it("says the machine is busy when the one-minute load passes the core count", () => {
    expect(loadLine(load(16, [31.26, 20, 10]))).toBe(
      "load 31.3 on 16 cores, busy: rerun a failed step alone before you believe it",
    )
  })

  it("states the load plainly on a quiet machine", () => {
    expect(loadLine(load(16, [3.04, 2, 1]))).toBe("load 3 on 16 cores")
  })
})

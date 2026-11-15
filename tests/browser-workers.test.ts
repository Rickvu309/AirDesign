import { describe, expect, it } from "vitest"
import { onCi, workerCap, workerLimit, workerOverrideName, workerRefusal } from "./browser-workers"

describe("the worker count of a browser run", () => {
  it("is a quarter of the cores, at most four and at least one", () => {
    expect(
      [1, 2, 3, 4, 7, 8, 15, 16, 32, 64].map((cores) => workerLimit({ cores, ci: false, override: undefined })),
    ).toEqual([1, 1, 1, 1, 1, 2, 3, 4, 4, 4])
    expect(workerCap).toBe(4)
  })

  it("is one per core on ci, whose runner runs nothing else", () => {
    expect(workerLimit({ cores: 4, ci: true, override: undefined })).toBe(4)
    expect(workerLimit({ cores: 16, ci: true, override: undefined })).toBe(16)
    expect(workerLimit({ cores: 4, ci: true, override: "2" })).toBe(4)
  })

  it("follows an override on a local machine", () => {
    expect(workerLimit({ cores: 16, ci: false, override: "12" })).toBe(12)
    expect(workerLimit({ cores: 16, ci: false, override: "1" })).toBe(1)
  })

  it("ignores an override that is not a whole number above zero", () => {
    for (const override of ["", "0", "-2", "many", "2.5"]) {
      expect(workerLimit({ cores: 16, ci: false, override })).toBe(4)
    }
  })
})

describe("the refusal of a worker count above the limit", () => {
  const request = { workers: 16, cores: 16, ci: false, override: undefined }

  it("says the cap, the request and the override in one line", () => {
    expect(workerRefusal(request)).toBe(
      `this machine is shared: use at most 4 workers, got 16; set ${workerOverrideName} to override`,
    )
    expect(workerRefusal(request)).not.toContain("\n")
  })

  it("names the limit of a small machine", () => {
    expect(workerRefusal({ ...request, workers: 3, cores: 8 })).toContain("use at most 2 workers, got 3")
  })

  it("lets a count at or under the limit through", () => {
    expect(workerRefusal({ ...request, workers: 4 })).toBeUndefined()
    expect(workerRefusal({ ...request, workers: 1 })).toBeUndefined()
  })

  it("lets any count through on ci", () => {
    expect(workerRefusal({ ...request, ci: true })).toBeUndefined()
    expect(workerRefusal({ ...request, cores: 4, ci: true })).toBeUndefined()
  })

  it("lets a count through up to the override", () => {
    expect(workerRefusal({ ...request, override: "16" })).toBeUndefined()
    expect(workerRefusal({ ...request, override: "8" })).toContain("use at most 8 workers, got 16")
  })
})

describe("the ci flag", () => {
  it("is set by CI=true or CI=1", () => {
    expect([{ CI: "true" }, { CI: "1" }, { CI: "false" }, { CI: "" }, {}].map(onCi)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ])
  })
})

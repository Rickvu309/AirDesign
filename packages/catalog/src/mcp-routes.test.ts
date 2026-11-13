import { describe, expect, it } from "vitest"

import { onceMeta, readOnce } from "./mcp-routes.js"

describe("readOnce", () => {
  it("reads no once from a request without one", () => {
    for (const meta of [undefined, null, {}, { progressToken: 1 }, "once"]) {
      expect(readOnce(meta)).toEqual({ ok: true, once: undefined })
    }
  })

  it("reads the once a request names in its meta", () => {
    expect(readOnce({ [onceMeta]: "call_1-A", progressToken: 1 })).toEqual({ ok: true, once: "call_1-A" })
  })

  it("refuses a once that is not 1 to 64 safe characters", () => {
    for (const once of ["", "a b", "x".repeat(65), 7, null]) {
      expect(readOnce({ [onceMeta]: once })).toEqual({ ok: false })
    }
  })
})

import { describe, expect, it } from "vitest"
import { resetsWhen, usagePercent } from "./aira-usage"

const resets = "2026-11-16T00:00:00.000Z"

describe("weekly usage readout", () => {
  it("rounds the share used to a whole percent and stops at 100", () => {
    expect(usagePercent({ used: 0.01464, allowed: 2, resets })).toBe(1)
    expect(usagePercent({ used: 0.5, allowed: 2, resets })).toBe(25)
    expect(usagePercent({ used: 2, allowed: 2, resets })).toBe(100)
    expect(usagePercent({ used: 3, allowed: 2, resets })).toBe(100)
    expect(usagePercent({ used: 0, allowed: 0, resets })).toBe(100)
  })

  it("says the reset in the person's own clock", () => {
    expect(resetsWhen(resets, { locale: "en-US", timeZone: "Asia/Ho_Chi_Minh" })).toBe("Monday at 7:00 AM")
    expect(resetsWhen(resets, { locale: "en-US", timeZone: "Asia/Singapore" })).toBe("Monday at 8:00 AM")
    expect(resetsWhen(resets, { locale: "en-US", timeZone: "America/Los_Angeles" })).toBe("Sunday at 4:00 PM")
  })
})

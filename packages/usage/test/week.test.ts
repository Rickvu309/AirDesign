import { expect, it } from "vitest"
import { usageWeek } from "../src/week.ts"
it("uses Monday 08:00 local time and local calendar weeks across both DST transitions", () => {
  const spring = usageWeek(Date.parse("2026-03-04T12:00:00Z"),"America/New_York")
  expect(spring.startsAt).toBe(Date.parse("2026-03-02T13:00:00Z"))
  expect(spring.resetsAt).toBe(Date.parse("2026-03-09T12:00:00Z"))
  expect(spring.resetsAt - spring.startsAt).toBe(167 * 3600000)
  const fall = usageWeek(Date.parse("2026-10-28T12:00:00Z"),"America/New_York")
  expect(fall.resetsAt - fall.startsAt).toBe(169 * 3600000)
  const before = usageWeek(Date.parse("2026-11-02T07:59:59Z"),"UTC")
  const after = usageWeek(Date.parse("2026-11-02T08:00:00Z"),"UTC")
  expect(before.id).not.toBe(after.id)
  expect(before.resetsAt).toBe(after.startsAt)
  expect(() => usageWeek(Date.now(),"invalid-zone")).toThrow()
})

it("chooses the earlier occurrence of Monday 08:00 when a whole date repeats",()=>{
  const first=usageWeek(Date.parse("1892-07-03T20:00:00Z"),"Pacific/Apia"),second=usageWeek(Date.parse("1892-07-04T20:00:00Z"),"Pacific/Apia")
  expect(first).toEqual(second)
  expect(first.resetsAt-first.startsAt).toBe(192*3600000)
})

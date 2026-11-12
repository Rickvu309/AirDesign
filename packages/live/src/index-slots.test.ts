import { beforeEach, expect, it } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { installSlots, readSlot } from "./store.js"

beforeEach(installIndexedDb)

it("keeps one complete index when two tabs install different page counts together", async () => {
  await Promise.all([
    installSlots("queue", [
      { key: "page-0", value: "first" },
      { key: "queue", value: { count: 1, sent: 0 } },
    ]),
    installSlots("queue", [
      { key: "page-0", value: "other" },
      { key: "page-1", value: "other-last" },
      { key: "queue", value: { count: 2, sent: 0 } },
    ]),
  ])
  expect(await readSlot("page-0")).toBe("first")
  expect(await readSlot("page-1")).toBeNull()
  expect(await readSlot("queue")).toEqual({ count: 1, sent: 0 })
})

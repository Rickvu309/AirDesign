import { expect, it } from "vitest"
import { storeLane } from "./store-lane"

it("starts a later change only once the earlier one is stored, without waiting for its paint", async () => {
  const lane = storeLane()
  const steps: string[] = []
  let store = () => undefined as void
  const first = lane(async (stored) => {
    steps.push("first reads")
    await new Promise<void>((done) => {
      store = done
    })
    steps.push("first stored")
    stored()
    await Promise.resolve()
    steps.push("first paints")
  })
  const second = lane(async () => {
    steps.push("second reads")
  })
  await Promise.resolve()
  expect(steps).toEqual(["first reads"])
  store()
  await Promise.all([first, second])
  expect(steps.indexOf("second reads")).toBeGreaterThan(steps.indexOf("first stored"))
})

it("lets the next change through when an earlier one is refused or throws", async () => {
  const lane = storeLane()
  await expect(lane(() => Promise.reject(new Error("refused")))).rejects.toThrow("refused")
  await expect(lane(() => Promise.resolve("kept"))).resolves.toBe("kept")
})

it("tells once every change queued so far is stored, without waiting for one queued after", async () => {
  const lane = storeLane()
  const steps: string[] = []
  const stores: (() => void)[] = []
  const held = (name: string) =>
    lane(async (stored) => {
      await new Promise<void>((done) => stores.push(done))
      steps.push(name)
      stored()
    })
  void held("first")
  void held("second")
  const both = lane.stored().then(() => steps.push("told"))
  void held("third")
  await Promise.resolve()
  stores.shift()?.()
  await new Promise((done) => setTimeout(done, 0))
  stores.shift()?.()
  await both
  expect(steps).toEqual(["first", "second", "told"])
  stores.shift()?.()
})

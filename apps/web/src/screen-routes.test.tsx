import { expect, it } from "vitest"
import { screenIndexPath, screens } from "@/screen-routes"

it("keeps every design screen under the screens address, where the app loads them", () => {
  const outside = Object.keys(screens).filter((path) => !path.startsWith(`${screenIndexPath}/`))
  expect(outside).toEqual([])
  expect(Object.keys(screens).length).toBeGreaterThan(0)
})

import { afterEach, expect } from "vitest"
import { propertyAsserts, resetPropertyAsserts } from "./property-count.mjs"

afterEach((ctx) => {
  ctx.task.meta.assertions = expect.getState().assertionCalls + propertyAsserts
  resetPropertyAsserts()
})

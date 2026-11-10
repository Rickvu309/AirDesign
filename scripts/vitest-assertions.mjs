import { afterEach, expect } from "vitest"
import { propertyAsserts, resetPropertyAsserts } from "fast-check"

afterEach((ctx) => {
  ctx.task.meta.assertions = expect.getState().assertionCalls + propertyAsserts
  resetPropertyAsserts()
})

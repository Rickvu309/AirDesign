import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { expect } from "vitest"
import { propertyParameters } from "./property-seed.mjs"

const require = createRequire(import.meta.url)
const loaded = await import(pathToFileURL(require.resolve("fast-check")).href)
const fc = loaded.default

export let propertyAsserts = 0

export const resetPropertyAsserts = () => {
  propertyAsserts = 0
}

const counting = new Proxy(fc, {
  get(target, prop, receiver) {
    if (prop === "assert") {
      return (property, parameters = {}) => {
        const { testPath, currentTestName } = expect.getState()
        const seeded = propertyParameters({
          env: process.env,
          parameters,
          file: testPath,
          test: currentTestName,
          index: propertyAsserts,
        })
        propertyAsserts += 1
        return target.assert(property, seeded)
      }
    }
    return Reflect.get(target, prop, receiver)
  },
})

export default counting

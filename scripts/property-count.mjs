import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

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
      return (...args) => {
        propertyAsserts += 1
        return target.assert(...args)
      }
    }
    return Reflect.get(target, prop, receiver)
  },
})

export default counting

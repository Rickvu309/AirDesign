import { keepGlobals } from "./kept-globals.mjs"

const fail = (message) => {
  throw new Error(message)
}

globalThis.keptBefore = "before"
const restore = keepGlobals()

Object.assign(globalThis, { document: { cookie: "account=one" } })
globalThis.keptBefore = "changed"
Object.defineProperty(globalThis, "keptHidden", { value: 1, configurable: true, enumerable: false })
const setTimeoutBefore = globalThis.setTimeout
globalThis.setTimeout = () => 0

restore()

if ("document" in globalThis) fail("a document one file left stays for the next file")
if ("keptHidden" in globalThis) fail("a hidden global one file added stays for the next file")
if (globalThis.keptBefore !== "before") fail("a global one file changed keeps its new value")
if (globalThis.setTimeout !== setTimeoutBefore) fail("a replaced setTimeout stays replaced")

delete globalThis.keptBefore
console.log("kept globals tests passed")

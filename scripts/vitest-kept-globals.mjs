import { afterAll } from "vitest"
import { keepGlobals } from "./kept-globals.mjs"

afterAll(keepGlobals())

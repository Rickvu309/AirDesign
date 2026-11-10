import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { prepareMarkup } from "./src/element-span.ts"

const require = createRequire(import.meta.url)

await prepareMarkup(new Uint8Array(readFileSync(require.resolve("sax-wasm/lib/sax-wasm.wasm"))))

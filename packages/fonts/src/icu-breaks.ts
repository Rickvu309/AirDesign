import type { FontLayout } from "./layout-contract.js"

const character = 0
const line = 2

export type Breaker = {
  readonly breaks: FontLayout["breaks"]
  readonly script: (codepoint: number) => string | undefined
  readonly properties: (codepoint: number) => number
}

async function instantiateIcu(imports: WebAssembly.Imports): Promise<WebAssembly.Instance> {
  const asset = new URL("../wasm/icu-breaks.wasm", import.meta.url)
  if (asset.protocol === "file:") {
    const { readFile } = process.getBuiltinModule("node:fs/promises")
    return (await WebAssembly.instantiate(await readFile(asset), imports)).instance
  }
  return (await WebAssembly.instantiateStreaming(fetch(asset), imports)).instance
}

function wasmFunction(value: WebAssembly.ExportValue | undefined): (...args: number[]) => unknown {
  if (typeof value !== "function") throw new Error("Unexpected ICU WASM exports")
  const call = value
  return (...args) => call(...args)
}

export async function loadBreaker(): Promise<Breaker> {
  let memory: WebAssembly.Memory
  const { exports } = await instantiateIcu({
    env: { emscripten_notify_memory_growth: () => undefined },
    wasi_snapshot_preview1: {
      fd_close: () => 8,
      environ_get: () => 0,
      environ_sizes_get: (count: number, size: number) => {
        const view = new DataView(memory.buffer)
        view.setUint32(count, 0, true)
        view.setUint32(size, 0, true)
        return 0
      },
    },
  })
  if (!(exports.memory instanceof WebAssembly.Memory)) throw new Error("Unexpected ICU WASM memory")
  memory = exports.memory
  wasmFunction(exports._initialize)()
  if (wasmFunction(exports.ad_init)() !== 0) throw new Error("ICU 77 data could not be loaded")
  const open = wasmFunction(exports.ad_breaks)
  const script = wasmFunction(exports.ad_script)
  const properties = wasmFunction(exports.ad_properties)
  const malloc = wasmFunction(exports.malloc)
  const free = wasmFunction(exports.free)
  const encoder = new TextEncoder()

  function breaks(type: number, text: string, locale: string): readonly number[] {
    const tag = encoder.encode(locale + "\0")
    const slots = text.length + 1
    const output = Number(malloc(slots * 6 + tag.length))
    if (output === 0) throw new Error("ICU break allocation failed")
    const input = output + slots * 4
    const language = input + slots * 2
    try {
      const utf16 = new Uint16Array(memory.buffer, input, slots)
      for (let at = 0; at < text.length; at++) utf16[at] = text.charCodeAt(at)
      utf16[text.length] = 0
      new Uint8Array(memory.buffer).set(tag, language)
      const count = Number(open(type, input, text.length, language, output))
      if (count < 0) throw new Error(`ICU break iterator failed (${String(count)})`)
      return Array.from(new Uint32Array(memory.buffer, output, count))
    } finally {
      free(output)
    }
  }

  return {
    breaks: ({ text, locale }: { readonly text: string; readonly locale: string }) => ({
      graphemes: breaks(character, text, "und"),
      opportunities: breaks(line, text, locale),
    }),
    script(codepoint: number) {
      const tag = Number(script(codepoint))
      return tag === 0 ? undefined : String.fromCharCode(tag >>> 24, (tag >>> 16) & 255, (tag >>> 8) & 255, tag & 255)
    },
    properties: (codepoint: number) => Number(properties(codepoint)),
  }
}

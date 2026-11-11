import { prepareMarkup } from "@airdesign/pptx"
import wasmUrl from "sax-wasm/lib/sax-wasm.wasm?url"

let markup: Promise<void> | null = null

export function ensureMarkup(): Promise<void> {
  if (markup === null) {
    markup = fetch(wasmUrl)
      .then(async (response) => {
        await prepareMarkup(new Uint8Array(await response.arrayBuffer()))
      })
      .catch((error: unknown) => {
        markup = null
        throw error
      })
  }
  return markup
}

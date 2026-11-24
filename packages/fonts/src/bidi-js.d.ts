declare module "bidi-js" {
  export default function bidiFactory(): {
    getEmbeddingLevels(text: string, direction?: "ltr" | "rtl"): { readonly levels: Uint8Array }
  }
}

import { createRequire } from "node:module"

export const { productCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/product-copy.ts")

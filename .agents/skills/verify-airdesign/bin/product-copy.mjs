import { createRequire } from "node:module"

export const { productCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/product-copy.ts")

export const { airaCopy, airaStepWords } = createRequire(import.meta.url)("../../../../apps/web/src/copy/aira-copy.ts")
export const { undoCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/undo-copy.ts")

import { createRequire } from "node:module"

export const { productCopy, starOf, unstarOf } = createRequire(import.meta.url)(
  "../../../../apps/web/src/copy/product-copy.ts",
)

export const { airaCopy, airaStepWords } = createRequire(import.meta.url)("../../../../apps/web/src/copy/aira-copy.ts")
export const { undoCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/undo-copy.ts")

export const { fillWords } = createRequire(import.meta.url)("../../../../apps/web/src/copy/fill-copy.ts")
export const { colorCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/color-copy.ts")
export const { formatCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/format-copy.ts")

export const { accountCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/account-copy.ts")
export const { boxCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/box-copy.ts")

export const { picturePanelCopy: pictureCopy } = createRequire(import.meta.url)(
  "../../../../apps/web/src/copy/picture-panel-copy.ts",
)

export const { lineCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/line-copy.ts")
export const { creditsCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/credits-copy.ts")

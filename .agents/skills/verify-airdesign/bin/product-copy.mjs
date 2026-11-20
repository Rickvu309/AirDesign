import { existsSync } from "node:fs"
import { createRequire, registerHooks } from "node:module"

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@airdesign/") && context.parentURL?.includes("/apps/web/src/copy/")) {
      return next(specifier, { ...context, conditions: [...context.conditions, "import"] })
    }
    if (specifier.startsWith(".") && context.parentURL?.includes("/apps/web/src/")) {
      const typed = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(typed)) return { url: typed.href, shortCircuit: true }
    }
    return next(specifier, context)
  },
})

export const { productCopy, starOf, unstarOf } = createRequire(import.meta.url)(
  "../../../../apps/web/src/copy/product-copy.ts",
)

export const { airaCopy, airaStepWords } = createRequire(import.meta.url)("../../../../apps/web/src/copy/aira-copy.ts")
export const { adjustToneCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/adjust-tone-copy.ts")
export const { toolbarCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/toolbar-copy.ts")
export const { undoCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/undo-copy.ts")

export const { fillCopy, fillWords } = createRequire(import.meta.url)("../../../../apps/web/src/copy/fill-copy.ts")
export const { colorCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/color-copy.ts")
export const { formatCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/format-copy.ts")

export const { accountCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/account-copy.ts")
export const { boxCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/box-copy.ts")
export const { designCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/design-copy.ts")

export const { picturePanelCopy: pictureCopy } = createRequire(import.meta.url)(
  "../../../../apps/web/src/copy/picture-panel-copy.ts",
)

export const { borderCopy, borderWords } = createRequire(import.meta.url)(
  "../../../../apps/web/src/copy/border-copy.ts",
)
export const { appearanceCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/appearance-copy.ts")
export const { transitionCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/transition-copy.ts")
export const { creditsCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/credits-copy.ts")

export function readPictureToolCopy() {
  return createRequire(import.meta.url)("../../../../apps/web/src/copy/picture-copy.ts").pictureCopy
}
export const { templateCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/template-copy.ts")
export const { templateStyleCopy } = createRequire(import.meta.url)(
  "../../../../apps/web/src/copy/template-style-copy.ts",
)

export const { slideListCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/slide-list-copy.ts")

export const { notesCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/notes-copy.ts")
export const { frameCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/frame-copy.ts")
export const { shapeCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/shape-copy.ts")
export const { arrangeCopy, groupCopy } = createRequire(import.meta.url)(
  "../../../../apps/web/src/copy/arrange-copy.ts",
)
export const { layersCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/layers-copy.ts")
export const { shortcutCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/shortcut-copy.ts")

export const { guideCopy, guideWords } = createRequire(import.meta.url)("../../../../apps/web/src/copy/guide-copy.ts")

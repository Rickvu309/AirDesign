import { trait } from "./trait-decl.js"
import { typefaceBytes } from "./text-value.js"
import { flag, hex, list, record, typeSize, words } from "./value-kind.js"

const typeface = words(typefaceBytes)
const customColor = record({ name: words(255), color: hex })
export const textStyleLimit = 64
const textStyleEdit = record({ id: words(200), size: typeSize, font: typeface })

export const templateStyle = trait(
  "own",
  { version: 5, shape: "facd0a47" },
  {
    id: words(256),
    name: words(256),
    dk1: hex,
    lt1: hex,
    dk2: hex,
    lt2: hex,
    accent1: hex,
    accent2: hex,
    accent3: hex,
    accent4: hex,
    accent5: hex,
    accent6: hex,
    hlink: hex,
    folHlink: hex,
    major: typeface,
    minor: typeface,
    custom: list(customColor, 0, 32),
    removed: flag,
    textStyle: list(textStyleEdit, 0, textStyleLimit),
  },
)

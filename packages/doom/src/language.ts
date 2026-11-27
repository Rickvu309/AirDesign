import { field } from "./intent-fields.js"
import { matching, type Reader } from "./read-kit.js"

const languagePattern = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u
export const readLanguage: Reader<string> = matching(languagePattern, 63, { code: "language-tag" })

export const languageField = field(
  {
    type: "string",
    pattern: languagePattern.source,
    maxLength: 63,
  },
  readLanguage,
)

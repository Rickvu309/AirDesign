import { field } from "./agent-fields.js"
import { matching, type Reader } from "./read-kit.js"

const languagePattern = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u
export const readLanguage: Reader<string> = matching(languagePattern, 63, "A language tag such as ja, ko or zh-Hant.")

export const languageField = field(
  {
    type: "string",
    pattern: languagePattern.source,
    maxLength: 63,
    description: "Deck or text language as a BCP 47 tag, for example ja or zh-Hant. Use und to infer it.",
  },
  readLanguage,
)

import { matching, type Reader } from "./read-kit.js"

export const languages = ["und", "ja", "ko", "zh-Hans", "zh-Hant"] as const

export const languagePattern = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u
export const readLanguage: Reader<string> = matching(languagePattern, 63, "A language tag such as ja, ko or zh-Hant.")

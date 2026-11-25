import { traditionalHan } from "./traditional-han.js"

const families = [
  [/\p{Script=Hangul}/u, "Noto Sans KR"],
  [/\p{Script=Arabic}/u, "Noto Sans Arabic"],
  [/\p{Script=Hebrew}/u, "Noto Sans Hebrew"],
  [/\p{Script=Thai}/u, "Noto Sans Thai"],
  [/\p{Script=Devanagari}/u, "Noto Sans Devanagari"],
] as const

const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}]/u
const bopomofo = /\p{Script=Bopomofo}/u
const han = /[\p{Script=Han}\p{Script_Extensions=Han}\p{Script_Extensions=Katakana}]/u
const jp = "Noto Sans JP"
const sc = "Noto Sans SC"
const tc = "Noto Sans TC"
const kr = "Noto Sans KR"

export function hanLanguage(texts: Iterable<string>): string {
  let hangul = false
  let hant = false
  for (const text of texts) {
    if (japanese.test(text)) return "ja"
    if (!han.test(text) && !families[0][0].test(text) && !bopomofo.test(text)) continue
    hangul ||= families[0][0].test(text)
    hant ||= bopomofo.test(text) || traditionalHan.test(text)
  }
  return hangul ? "ko" : hant ? "zh-Hant" : "und"
}

export function scriptFonts(cluster: string, locale: string): readonly string[] {
  const script = families.find(([pattern]) => pattern.test(cluster))
  if (script !== undefined) return [script[1]]
  if (japanese.test(cluster)) return [jp]
  if (bopomofo.test(cluster)) return [tc]
  if (!han.test(cluster)) return []
  const language = locale.toLowerCase().split("-")
  if (language[0] === "ja") return [jp, sc, tc, kr]
  if (language[0] === "ko") return [kr, jp, sc, tc]
  if (language[0] === "zh" && language.some((part) => ["hant", "tw", "hk", "mo"].includes(part)))
    return [tc, sc, jp, kr]
  return [sc, tc, jp, kr]
}

type Token = { readonly kind: "text"; readonly text: string } | { readonly kind: "digit"; readonly char: string }

const plainCharacters = new Set("$-+/():!^&'~{}<>= ")
const digitCharacters = new Set("0#?,.")
const colorTag = /^(black|blue|cyan|green|magenta|red|white|yellow|color\d{1,2})$/i
const currencyTag = /^\$([^-]*)(-[\da-f]+)?$/i
const generalWord = /general/i
const generalDigits = 10
const largestFixed = 1e21

function text(value: string): Token {
  return { kind: "text", text: value }
}

function sectionsOf(code: string): readonly string[] {
  const sections: string[] = []
  let quoted = false
  let bracketed = false
  let start = 0
  for (let at = 0; at < code.length; at += 1) {
    const character = code[at]
    if (character === '"' && !bracketed) quoted = !quoted
    else if (character === "[" && !quoted) bracketed = true
    else if (character === "]" && !quoted) bracketed = false
    else if (character === "\\" && !quoted) at += 1
    else if (character === ";" && !quoted && !bracketed) {
      sections.push(code.slice(start, at))
      start = at + 1
    }
  }
  sections.push(code.slice(start))
  return sections
}

function tokensOf(section: string): readonly Token[] | null {
  const tokens: Token[] = []
  let at = 0
  while (at < section.length) {
    const character = section[at] ?? ""
    if (character === '"') {
      const end = section.indexOf('"', at + 1)
      if (end < 0) return null
      tokens.push(text(section.slice(at + 1, end)))
      at = end + 1
    } else if (character === "\\") {
      tokens.push(text(section[at + 1] ?? ""))
      at += 2
    } else if (character === "[") {
      const end = section.indexOf("]", at)
      if (end < 0) return null
      const tag = section.slice(at + 1, end)
      const currency = currencyTag.exec(tag)
      if (currency !== null) tokens.push(text(currency[1] ?? ""))
      else if (!colorTag.test(tag)) return null
      at = end + 1
    } else if (character === "_" || character === "*") at += 2
    else if (digitCharacters.has(character)) {
      tokens.push({ kind: "digit", char: character })
      at += 1
    } else if (character === "%" || plainCharacters.has(character)) {
      tokens.push(text(character))
      at += 1
    } else return null
  }
  return tokens
}

function general(value: number): string {
  return String(Number(value.toPrecision(generalDigits)))
}

function grouped(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function written(value: number, tokens: readonly Token[]): string | null {
  const first = tokens.findIndex((token) => token.kind === "digit")
  if (first < 0) return tokens.map((token) => (token.kind === "text" ? token.text : "")).join("")
  const last = tokens.findLastIndex((token) => token.kind === "digit")
  const run = tokens.slice(first, last + 1)
  if (run.some((token) => token.kind !== "digit")) return null
  const pattern = run.map((token) => (token.kind === "digit" ? token.char : "")).join("")
  const [whole = "", fraction, extra] = pattern.split(".")
  if (extra !== undefined || whole.endsWith(",") || (fraction ?? "").includes(",")) return null
  const outside = [...tokens.slice(0, first), ...tokens.slice(last + 1)]
  const percents = outside.filter((token) => token.kind === "text" && token.text === "%").length
  const scaled = value * 100 ** percents
  const places = fraction?.length ?? 0
  if (scaled >= largestFixed) return null
  const [integer = "", decimals = ""] = scaled.toFixed(places).split(".")
  let kept = decimals
  const least = [...(fraction ?? "")].filter((character) => character === "0").length
  while (kept.length > least && kept.endsWith("0")) kept = kept.slice(0, -1)
  const fewest = [...whole].filter((character) => character === "0").length
  const digits = (integer === "0" && fewest === 0 ? "" : integer).padStart(fewest, "0")
  const number = (whole.includes(",") ? grouped(digits) : digits) + (fraction === undefined ? "" : `.${kept}`)
  const words = (from: readonly Token[]) => from.map((token) => (token.kind === "text" ? token.text : "")).join("")
  return words(tokens.slice(0, first)) + number + words(tokens.slice(last + 1))
}

function wordsOf(tokens: readonly Token[] | null): string | null {
  if (tokens === null || !tokens.every((token) => token.kind === "text")) return null
  return tokens.map((token) => (token.kind === "text" ? token.text : "")).join("")
}

function generalAround(section: string): readonly [string, string] | null {
  const word = generalWord.exec(section)
  if (word === null) return null
  const before = wordsOf(tokensOf(section.slice(0, word.index)))
  const after = wordsOf(tokensOf(section.slice(word.index + word[0].length)))
  return before === null || after === null ? null : [before, after]
}

export function chartNumber(value: number, code: string): string | null {
  const sections = sectionsOf(code)
  const negative = value < 0
  const own = negative && sections.length > 1
  const chosen = own ? sections[1] : value === 0 && sections.length > 2 ? sections[2] : sections[0]
  const sign = negative && !own ? "-" : ""
  if (chosen === undefined) return sign + general(Math.abs(value))
  const around = generalAround(chosen)
  if (around !== null) return sign + around[0] + general(Math.abs(value)) + around[1]
  const tokens = tokensOf(chosen)
  if (tokens === null) return null
  const body = written(Math.abs(value), tokens)
  return body === null ? null : sign + body
}

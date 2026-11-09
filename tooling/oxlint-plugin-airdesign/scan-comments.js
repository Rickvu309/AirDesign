import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const suppressionMessage =
  "Remove this suppression. eslint-disable and oxlint-disable are comments, and comments are not allowed."
const commentMessage = "Remove this comment."

const directivePattern = new RegExp("(?:eslint-disable|oxlint-disable)\\b", "u")
const commentMarkPattern = new RegExp("//|/\\*|\\*/", "u")

const directiveExtensions = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".cts",
  ".mts",
  ".astro",
  ".vue",
  ".svelte",
])
const markupExtensions = new Set([".astro", ".vue", ".svelte"])
const styleAttributeExtensions = new Set([...markupExtensions, ".jsx", ".tsx"])
const scannedExtensions = new Set([...directiveExtensions, ".css", ".yml", ".yaml"])
const skipDirectories = new Set(["node_modules", "dist", ".astro"])
const regexKeywords = new Set([
  "return",
  "throw",
  "case",
  "delete",
  "void",
  "typeof",
  "instanceof",
  "in",
  "of",
  "yield",
  "await",
  "else",
  "do",
])

const consumeRegex = (source, index) => {
  let cursor = index + 1
  let inClass = false
  while (cursor < source.length) {
    const current = source[cursor]
    if (current === "\n") return cursor
    if (current === "\\") {
      cursor += source[cursor + 1] === undefined ? 1 : 2
      continue
    }
    if (inClass) {
      if (current === "]") inClass = false
      cursor += 1
      continue
    }
    if (current === "[") {
      inClass = true
      cursor += 1
      continue
    }
    if (current === "/") {
      cursor += 1
      while (cursor < source.length && /[a-z]/iu.test(source[cursor])) cursor += 1
      return cursor
    }
    cursor += 1
  }
  return cursor
}

export const requiredComments = []

const isRequired = (filename, line) =>
  requiredComments.some((entry) => entry.path === filename && (entry.line === undefined || entry.line === line))

const blankLiterals = (source) => {
  const chars = source.split("")
  let state = "code"
  let quote = ""
  const expressionDepths = []
  let regexOk = true
  let word = ""
  let index = 0
  while (index < chars.length) {
    const current = chars[index]
    const next = chars[index + 1]
    if (state === "line") {
      if (current === "\n") state = "code"
      index += 1
      continue
    }
    if (state === "block") {
      if (current === "*" && next === "/") {
        state = "code"
        index += 2
        continue
      }
      index += 1
      continue
    }
    if (state === "string") {
      if (current === "\\") {
        chars[index] = " "
        if (next !== undefined && next !== "\n") chars[index + 1] = " "
        index += next === undefined ? 1 : 2
        continue
      }
      if (current === "\n") {
        state = "code"
        index += 1
        continue
      }
      chars[index] = " "
      if (current === quote) {
        state = "code"
        regexOk = false
        word = ""
      }
      index += 1
      continue
    }
    if (state === "template") {
      if (current === "\n") {
        index += 1
        continue
      }
      if (current === "\\") {
        chars[index] = " "
        if (next !== undefined && next !== "\n") chars[index + 1] = " "
        index += next === undefined ? 1 : 2
        continue
      }
      if (current === "`") {
        chars[index] = " "
        state = "code"
        regexOk = false
        word = ""
        index += 1
        continue
      }
      if (current === "$" && next === "{") {
        chars[index] = " "
        chars[index + 1] = " "
        expressionDepths.push(1)
        state = "code"
        index += 2
        continue
      }
      chars[index] = " "
      index += 1
      continue
    }
    if (current === "/") {
      if (word.length > 0) {
        regexOk = regexKeywords.has(word)
        word = ""
      }
      if (next === "/") {
        state = "line"
        index += 2
        continue
      }
      if (next === "*") {
        state = "block"
        index += 2
        continue
      }
      if (regexOk) {
        const after = consumeRegex(chars, index)
        for (let cursor = index; cursor < after; cursor += 1) {
          if (chars[cursor] !== "\n") chars[cursor] = " "
        }
        index = after
        regexOk = false
        continue
      }
      regexOk = true
      index += 1
      continue
    }
    if (current === "'" || current === '"') {
      quote = current
      state = "string"
      chars[index] = " "
      index += 1
      continue
    }
    if (current === "`") {
      state = "template"
      chars[index] = " "
      index += 1
      continue
    }
    if (expressionDepths.length > 0) {
      if (current === "{") expressionDepths[expressionDepths.length - 1] += 1
      if (current === "}") {
        expressionDepths[expressionDepths.length - 1] -= 1
        if (expressionDepths[expressionDepths.length - 1] === 0) {
          expressionDepths.pop()
          state = "template"
        }
      }
    }
    if (/[A-Za-z0-9_$]/u.test(current)) {
      word += current
    } else {
      if (word.length > 0) {
        regexOk = regexKeywords.has(word)
        word = ""
      }
      if (!/\s/u.test(current)) regexOk = "([{=,:;!?&|~^%*+-<>".includes(current)
    }
    index += 1
  }
  return chars.join("")
}

const blockContinues = (line, inBlock) => {
  let block = inBlock
  let index = 0
  while (index < line.length) {
    if (block) {
      const end = line.indexOf("*/", index)
      if (end === -1) return true
      block = false
      index = end + 2
      continue
    }
    const start = line.indexOf("/*", index)
    const lineComment = line.indexOf("//", index)
    if (lineComment !== -1 && (start === -1 || lineComment < start)) return false
    if (start === -1) return false
    block = true
    index = start + 2
  }
  return block
}

const directiveLines = (source) => {
  const lines = blankLiterals(source).split("\n")
  const found = []
  let inBlock = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (directivePattern.test(line) && (inBlock || commentMarkPattern.test(line))) found.push(index + 1)
    inBlock = blockContinues(line, inBlock)
  }
  return found
}

const cssCommentLines = (source) => {
  const found = []
  let state = "code"
  let quote = ""
  let line = 1
  let index = 0
  while (index < source.length) {
    const current = source[index]
    const next = source[index + 1]
    if (state === "string" && current === "\\") {
      if (next === "\n") line += 1
      index += next === undefined ? 1 : 2
      continue
    }
    if (current === "\n") {
      if (state === "string") state = "code"
      line += 1
      index += 1
      continue
    }
    if (state === "comment") {
      if (current === "*" && next === "/") {
        state = "code"
        index += 2
        continue
      }
      index += 1
      continue
    }
    if (state === "string") {
      if (current === quote) state = "code"
      index += 1
      continue
    }
    if (current === "/" && next === "*") {
      found.push(line)
      state = "comment"
      index += 2
      continue
    }
    if (current === "'" || current === '"') {
      quote = current
      state = "string"
    }
    index += 1
  }
  return found
}

const yamlCommentLines = (source) => {
  const found = []
  const lines = source.split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    let quote = ""
    let cursor = 0
    let comment = false
    while (cursor < line.length) {
      const current = line[cursor]
      if (quote === "'") {
        if (current === "'") {
          if (line[cursor + 1] === "'") {
            cursor += 2
            continue
          }
          quote = ""
        }
        cursor += 1
        continue
      }
      if (quote === '"') {
        if (current === "\\") {
          cursor += 2
          continue
        }
        if (current === '"') quote = ""
        cursor += 1
        continue
      }
      if (current === "'" || current === '"') {
        quote = current
        cursor += 1
        continue
      }
      if (current === "#" && (cursor === 0 || /\s/u.test(line[cursor - 1]))) {
        comment = true
        break
      }
      cursor += 1
    }
    if (comment) found.push(index + 1)
  }
  return found
}

const readStyleBlock = (source, start) => {
  const comments = []
  let line = source.slice(0, start).split("\n").length
  let state = "code"
  let quote = ""
  let index = start
  while (index < source.length) {
    const current = source[index]
    const next = source[index + 1]
    if (state === "string" && current === "\\") {
      if (next === "\n") line += 1
      index += next === undefined ? 1 : 2
      continue
    }
    if (current === "\n") {
      if (state === "string") state = "code"
      line += 1
      index += 1
      continue
    }
    if (state === "comment") {
      if (current === "*" && next === "/") {
        state = "code"
        index += 2
        continue
      }
      index += 1
      continue
    }
    if (state === "string") {
      if (current === quote) state = "code"
      index += 1
      continue
    }
    if (current === "<" && source.slice(index, index + 7).toLowerCase() === "</style") {
      let cursor = index + 7
      while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1
      if (source[cursor] === ">") return { after: cursor + 1, comments }
    }
    if (current === "/" && next === "*") {
      comments.push(line)
      state = "comment"
      index += 2
      continue
    }
    if (current === "'" || current === '"') {
      quote = current
      state = "string"
      index += 1
      continue
    }
    index += 1
  }
  return { after: -1, comments }
}

const styleCommentLines = (source) => {
  const found = []
  const open = /<style\b[^>]*>/giu
  let match = open.exec(source)
  while (match) {
    const block = readStyleBlock(source, match.index + match[0].length)
    found.push(...block.comments)
    if (block.after === -1) break
    open.lastIndex = block.after
    match = open.exec(source)
  }
  return found
}

const htmlCommentLines = (source) => {
  const withoutJsComments = blankJavaScriptComments(blankLiterals(source))
  const found = []
  let line = 1
  for (let index = 0; index < withoutJsComments.length; index += 1) {
    if (withoutJsComments[index] === "\n") {
      line += 1
      continue
    }
    if (withoutJsComments.startsWith("<!--", index)) found.push(line)
  }
  return found
}

const blankJavaScriptComments = (source) => {
  const chars = source.split("")
  let state = "code"
  let index = 0
  while (index < chars.length) {
    const current = chars[index]
    const next = chars[index + 1]
    if (state === "code") {
      if (current === "/" && next === "/") {
        while (index < chars.length && chars[index] !== "\n") {
          chars[index] = " "
          index += 1
        }
        continue
      }
      if (current === "/" && next === "*") {
        chars[index] = " "
        chars[index + 1] = " "
        state = "block"
        index += 2
        continue
      }
      index += 1
      continue
    }
    if (current === "\n") {
      index += 1
      continue
    }
    chars[index] = " "
    if (current === "*" && next === "/") {
      chars[index + 1] = " "
      state = "code"
      index += 2
      continue
    }
    index += 1
  }
  return chars.join("")
}

const unique = (lines) => [...new Set(lines)]

const expressionCommentLines = (source) => {
  const text = blankLiterals(source)
  const found = []
  let line = 1
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1
      continue
    }
    if (text[index] !== "{") continue
    let cursor = index + 1
    let commentLine = line
    while (cursor < text.length && /\s/u.test(text[cursor])) {
      if (text[cursor] === "\n") commentLine += 1
      cursor += 1
    }
    if (text.startsWith("/*", cursor)) found.push(commentLine)
  }
  return found
}

const startsTag = (source, index) => {
  if (source[index] !== "<") return false
  const next = source[index + 1]
  if (/[A-Za-z]/u.test(next ?? "")) return true
  return next === "/" && /[A-Za-z]/u.test(source[index + 2] ?? "")
}

const readQuoted = (source, index) => {
  const quote = source[index]
  let cursor = index + 1
  let value = ""
  while (cursor < source.length) {
    const current = source[cursor]
    const next = source[cursor + 1]
    if (current === "\\") {
      value += current
      if (next !== undefined) value += next
      cursor += next === undefined ? 1 : 2
      continue
    }
    if (current === quote) return { value, after: cursor + 1 }
    value += current
    cursor += 1
  }
  return { value, after: source.length }
}

const styleAttributeCommentLines = (source) => {
  const found = []
  let state = "code"
  let quote = ""
  let regexOk = true
  let word = ""
  let index = 0
  while (index < source.length) {
    const current = source[index]
    const next = source[index + 1]
    if (current === "\n") {
      if (state === "string") {
        state = "code"
        regexOk = false
        word = ""
      }
      index += 1
      continue
    }
    if (state === "attr") {
      if (current === "\\") {
        index += next === undefined ? 1 : 2
        continue
      }
      if (current === quote) state = "tag"
      index += 1
      continue
    }
    if (state === "string" || state === "template") {
      if (current === "\\") {
        index += next === undefined ? 1 : 2
        continue
      }
      if ((state === "string" && current === quote) || (state === "template" && current === "`")) {
        state = "code"
        regexOk = false
        word = ""
      }
      index += 1
      continue
    }
    if (state === "tag") {
      if (current === "'" || current === '"') {
        quote = current
        state = "attr"
        index += 1
        continue
      }
      if (current === ">") {
        state = "code"
        regexOk = false
        word = ""
        index += 1
        continue
      }
      const attribute = source.slice(index, index + 5).toLowerCase()
      const before = index === 0 ? " " : source[index - 1]
      const after = source[index + 5] ?? " "
      if (attribute === "style" && !/[A-Za-z0-9_-]/u.test(before) && !/[A-Za-z0-9_-]/u.test(after)) {
        let cursor = index + 5
        while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1
        if (source[cursor] === "=") {
          cursor += 1
          while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1
          if (source[cursor] === "'" || source[cursor] === '"') {
            const valueStart = cursor + 1
            const quoted = readQuoted(source, cursor)
            const baseLine = source.slice(0, valueStart).split("\n").length
            for (const line of cssCommentLines(quoted.value)) found.push(baseLine + line - 1)
            index = quoted.after
            continue
          }
        }
      }
      index += 1
      continue
    }
    if (current === "/") {
      if (word.length > 0) {
        regexOk = regexKeywords.has(word)
        word = ""
      }
      if (regexOk && next !== "/" && next !== "*") {
        index = consumeRegex(source, index)
        regexOk = false
        continue
      }
      regexOk = true
      index += 1
      continue
    }
    if (startsTag(source, index)) {
      state = "tag"
      word = ""
      index += 1
      continue
    }
    if (/[A-Za-z0-9_$]/u.test(current)) word += current
    else if (word.length > 0) {
      regexOk = regexKeywords.has(word)
      word = ""
    }
    if (!/[A-Za-z0-9_$\s]/u.test(current)) regexOk = "([{=,:;!?&|~^%*+-<>".includes(current)
    if (current === "'" || current === '"') {
      quote = current
      state = "string"
      index += 1
      continue
    }
    if (current === "`") {
      state = "template"
      index += 1
      continue
    }
    index += 1
  }
  return found
}

export const scanSource = (filename, source) => {
  const extension = path.extname(filename).toLowerCase()
  const hits = []
  const push = (line, message) => {
    if (isRequired(filename, line)) return
    hits.push(`${filename}:${line}: ${message}`)
  }
  if (directiveExtensions.has(extension)) {
    for (const line of directiveLines(source)) push(line, suppressionMessage)
  }
  if (extension === ".css") {
    for (const line of unique(cssCommentLines(source))) push(line, commentMessage)
  }
  if (extension === ".yml" || extension === ".yaml") {
    for (const line of yamlCommentLines(source)) push(line, commentMessage)
  }
  if (markupExtensions.has(extension)) {
    for (const line of unique(htmlCommentLines(source))) push(line, commentMessage)
    for (const line of unique(styleCommentLines(source))) push(line, commentMessage)
    for (const line of unique(expressionCommentLines(source))) push(line, commentMessage)
  }
  if (styleAttributeExtensions.has(extension)) {
    for (const line of unique(styleAttributeCommentLines(source))) push(line, commentMessage)
  }
  return hits
}

const filesUnder = (absolute) => {
  const info = fs.statSync(absolute, { throwIfNoEntry: false })
  if (!info) return []
  if (info.isDirectory()) {
    if (skipDirectories.has(path.basename(absolute))) return []
    return fs.readdirSync(absolute).flatMap((name) => filesUnder(path.join(absolute, name)))
  }
  if (!info.isFile()) return []
  return [absolute]
}

export const collectHits = (root, relativePaths) => {
  const hits = []
  for (const relativePath of relativePaths) {
    const absolute = path.resolve(root, relativePath)
    for (const file of filesUnder(absolute)) {
      const extension = path.extname(file).toLowerCase()
      if (!scannedExtensions.has(extension)) continue
      const relative = path.relative(root, file).split(path.sep).join("/")
      hits.push(...scanSource(relative, fs.readFileSync(file, "utf8")))
    }
  }
  return hits
}

const entry = process.argv[1]
const self = fileURLToPath(import.meta.url)
if (entry && path.resolve(entry) === self) {
  const root = path.resolve(path.dirname(self), "../..")
  const hits = collectHits(root, process.argv.slice(2))
  if (hits.length === 0) process.exit(0)
  for (const hit of hits) console.error(hit)
  process.exit(1)
}

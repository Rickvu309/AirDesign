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
const skipDirectories = new Set(["node_modules", "dist"])
const headerKeywords = new Set(["if", "while", "for", "with", "catch", "switch"])
const declarationModifiers = new Set(["async", "abstract", "declare"])
const expressionKeywords = new Set([
  "return",
  "throw",
  "delete",
  "void",
  "typeof",
  "instanceof",
  "in",
  "of",
  "yield",
  "await",
  "new",
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

const createLexer = () => ({
  regexOk: true,
  word: "",
  parens: [],
  braces: [],
  pendingHeader: false,
  pendingBody: "",
  pendingDeclaration: false,
  pendingLabel: false,
  pendingCase: false,
  pendingBrace: false,
  pendingNameBlock: false,
  pendingLabelWord: false,
  pendingModule: false,
  pendingType: false,
  typeCanEnd: false,
  postfix: false,
  context: "stmt",
})

const resetLexer = (lexer) => {
  const fresh = createLexer()
  for (const key of Object.keys(fresh)) lexer[key] = fresh[key]
}

const finishWord = (lexer) => {
  const word = lexer.word
  if (word.length === 0) return
  lexer.word = ""
  const declaration = lexer.context === "stmt" || lexer.pendingDeclaration
  const wasHeader = lexer.pendingHeader
  const afterBreak = lexer.pendingLabelWord
  lexer.pendingHeader = false
  lexer.pendingDeclaration = false
  lexer.pendingLabel = false
  lexer.pendingBrace = false
  lexer.pendingNameBlock = false
  lexer.pendingLabelWord = false
  if (headerKeywords.has(word)) {
    lexer.pendingHeader = true
    lexer.regexOk = false
    lexer.context = "stmt"
    return
  }
  if (word === "else" || word === "do" || word === "try" || word === "finally") {
    lexer.regexOk = true
    lexer.context = "stmt"
    return
  }
  if (word === "export") {
    lexer.pendingDeclaration = true
    lexer.regexOk = false
    lexer.context = "stmt"
    return
  }
  if (word === "function" || word === "class") {
    lexer.pendingBody = declaration ? "declaration" : "expression"
    lexer.regexOk = false
    lexer.context = "stmt"
    return
  }
  if (declarationModifiers.has(word) && declaration) {
    lexer.pendingDeclaration = true
    lexer.regexOk = false
    lexer.context = "stmt"
    return
  }
  if (word === "static") {
    lexer.pendingNameBlock = true
    lexer.regexOk = false
    lexer.context = "expr"
    return
  }
  if (word === "default") {
    lexer.pendingDeclaration = true
    lexer.regexOk = true
    lexer.context = "expr"
    return
  }
  if (word === "case") {
    lexer.pendingCase = true
    lexer.regexOk = true
    lexer.context = "expr"
    return
  }
  if (word === "break" || word === "continue") {
    lexer.pendingLabelWord = true
    lexer.regexOk = true
    lexer.context = "stmt"
    return
  }
  if (word === "debugger") {
    lexer.regexOk = true
    lexer.context = "stmt"
    return
  }
  if (word === "import") {
    lexer.pendingModule = true
    lexer.regexOk = false
    lexer.context = "stmt"
    return
  }
  if (word === "from" && (lexer.pendingModule || lexer.context === "stmt")) {
    lexer.pendingModule = true
    lexer.regexOk = false
    lexer.context = "expr"
    return
  }
  if (word === "await" && wasHeader) {
    lexer.pendingHeader = true
    lexer.regexOk = true
    lexer.context = "expr"
    return
  }
  if ((word === "interface" || word === "enum" || word === "namespace") && declaration && !lexer.pendingModule) {
    lexer.pendingBody = "declaration"
    lexer.regexOk = false
    lexer.context = "stmt"
    return
  }
  if (word === "type" && lexer.pendingModule) {
    lexer.regexOk = false
    lexer.context = "expr"
    return
  }
  if (word === "type" && declaration) {
    lexer.pendingType = true
    lexer.typeCanEnd = false
    lexer.regexOk = false
    lexer.context = "stmt"
    return
  }
  if (expressionKeywords.has(word)) {
    lexer.regexOk = true
    lexer.context = "expr"
    return
  }
  if (afterBreak) {
    lexer.regexOk = true
    lexer.context = "stmt"
    return
  }
  if (lexer.pendingType) {
    lexer.typeCanEnd = lexer.braces.length === 0 && lexer.parens.length === 0
    lexer.regexOk = false
    lexer.context = "expr"
    return
  }
  lexer.pendingLabel = lexer.context === "stmt"
  lexer.regexOk = false
  lexer.context = "expr"
}

const finishModuleString = (lexer) => {
  lexer.word = ""
  if (lexer.pendingModule && lexer.parens.length === 0) {
    lexer.pendingModule = false
    lexer.regexOk = true
    lexer.context = "stmt"
    return
  }
  lexer.regexOk = false
  lexer.context = "expr"
}

const noteSymbol = (lexer, current, previous, beforePrevious, next) => {
  finishWord(lexer)
  if (lexer.postfix) {
    lexer.postfix = false
    lexer.pendingHeader = false
    lexer.pendingLabel = false
    lexer.pendingBrace = false
    lexer.pendingNameBlock = false
    lexer.regexOk = false
    lexer.context = "expr"
    return
  }
  if (current === "{") {
    let kind = "expr"
    const body = lexer.parens.length === 0 && (lexer.pendingBrace || lexer.pendingNameBlock || lexer.context === "stmt")
    if (lexer.parens.length === 0 && lexer.pendingBody === "declaration") kind = "block"
    else if (lexer.parens.length === 0 && lexer.pendingBody === "expression") kind = "fn"
    else if (body) kind = "block"
    if (lexer.parens.length === 0) lexer.pendingBody = ""
    lexer.pendingBrace = false
    lexer.pendingNameBlock = false
    lexer.braces.push(kind)
    lexer.pendingHeader = false
    lexer.pendingDeclaration = false
    lexer.pendingLabel = false
    if (kind === "expr") {
      lexer.regexOk = true
      lexer.context = "expr"
    } else {
      lexer.regexOk = true
      lexer.context = "stmt"
    }
    return
  }
  if (current === "\n") {
    if (lexer.pendingType && lexer.typeCanEnd && lexer.parens.length === 0 && lexer.braces.length === 0) {
      lexer.pendingType = false
      lexer.typeCanEnd = false
      lexer.regexOk = true
      lexer.context = "stmt"
    }
    lexer.pendingLabelWord = false
    return
  }
  if (/\s/u.test(current)) return
  lexer.pendingBrace = false
  lexer.pendingNameBlock = false
  lexer.pendingLabelWord = false
  if (current === "(") {
    lexer.pendingModule = false
    lexer.parens.push(lexer.pendingHeader ? "header" : "expr")
    lexer.pendingHeader = false
    lexer.pendingLabel = false
    lexer.regexOk = true
    lexer.context = "expr"
    return
  }
  if (current === ")") {
    const kind = lexer.parens.pop() ?? "expr"
    lexer.pendingHeader = false
    lexer.pendingLabel = false
    lexer.pendingBrace = true
    if (kind === "header") {
      lexer.regexOk = true
      lexer.context = "stmt"
    } else {
      lexer.regexOk = false
      lexer.context = "expr"
    }
    return
  }
  if (current === "}") {
    const kind = lexer.braces.pop() ?? "block"
    lexer.pendingHeader = false
    if (lexer.parens.length === 0) lexer.pendingBody = ""
    lexer.pendingDeclaration = false
    lexer.pendingLabel = false
    lexer.pendingCase = false
    if (kind === "block") {
      lexer.regexOk = true
      lexer.context = "stmt"
    } else {
      lexer.regexOk = false
      lexer.context = "expr"
    }
    if (lexer.pendingType && lexer.parens.length === 0 && lexer.braces.length === 0) lexer.typeCanEnd = true
    return
  }
  if (current === "[") {
    lexer.pendingHeader = false
    lexer.pendingLabel = false
    lexer.regexOk = true
    lexer.context = "expr"
    return
  }
  if (current === "]") {
    lexer.pendingHeader = false
    lexer.pendingLabel = false
    lexer.regexOk = false
    lexer.context = "expr"
    return
  }
  if (current === ";") {
    lexer.pendingHeader = false
    lexer.pendingBody = ""
    lexer.pendingDeclaration = false
    lexer.pendingLabel = false
    lexer.pendingCase = false
    lexer.pendingType = false
    lexer.typeCanEnd = false
    lexer.pendingModule = false
    lexer.pendingLabelWord = false
    lexer.regexOk = true
    lexer.context = "stmt"
    return
  }
  if (current === ":" && lexer.parens.length === 0 && (lexer.pendingCase || lexer.pendingLabel)) {
    lexer.pendingHeader = false
    lexer.pendingLabel = false
    lexer.pendingCase = false
    lexer.regexOk = true
    lexer.context = "stmt"
    return
  }
  if (current === ">" && previous === "=") {
    lexer.pendingHeader = false
    lexer.pendingBody = ""
    lexer.pendingDeclaration = false
    lexer.pendingLabel = false
    if (lexer.pendingType) lexer.typeCanEnd = false
    lexer.regexOk = true
    lexer.context = "stmt"
    return
  }
  if (current === ">") {
    lexer.pendingHeader = false
    lexer.pendingDeclaration = false
    lexer.pendingLabel = false
    if (lexer.pendingType) lexer.typeCanEnd = lexer.parens.length === 0 && lexer.braces.length === 0
    lexer.regexOk = true
    lexer.context = "stmt"
    return
  }
  if (current === "." && previous === "." && beforePrevious === ".") {
    lexer.pendingHeader = false
    lexer.pendingLabel = false
    lexer.regexOk = true
    lexer.context = "expr"
    return
  }
  if ((current === "+" || current === "-") && !lexer.regexOk && next === current) {
    lexer.postfix = true
    lexer.pendingHeader = false
    lexer.pendingLabel = false
    lexer.regexOk = false
    lexer.context = "expr"
    return
  }
  if ("=,:!?&|~^%*+-<>".includes(current)) {
    lexer.pendingHeader = false
    lexer.pendingDeclaration = false
    lexer.pendingLabel = false
    if (lexer.pendingType) lexer.typeCanEnd = false
    lexer.regexOk = true
    lexer.context = "expr"
    return
  }
  if (!/\s/u.test(current)) {
    lexer.pendingHeader = false
    lexer.pendingLabel = false
    lexer.regexOk = false
    lexer.context = "expr"
  }
}

const covers = (ranges, index) => {
  if (ranges === null) return true
  for (const range of ranges) {
    if (index >= range[0] && index < range[1]) return true
  }
  return false
}

const closesScript = (source, index) => {
  if (source.slice(index, index + 8).toLowerCase() !== "</script") return false
  let cursor = index + 8
  while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1
  return source[cursor] === ">"
}

const readScriptEnd = (source, start) => {
  const lexer = createLexer()
  let state = "code"
  let quote = ""
  let depth = 0
  let index = start
  while (index < source.length) {
    const current = source[index]
    const next = source[index + 1]
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
        index += next === undefined ? 1 : 2
        continue
      }
      if (current === "\n" || current === quote) state = "code"
      index += 1
      continue
    }
    if (state === "template") {
      if (current === "\\") {
        index += next === undefined ? 1 : 2
        continue
      }
      if (current === "`" && depth === 0) {
        state = "code"
        index += 1
        continue
      }
      if (current === "$" && next === "{") {
        depth += 1
        index += 2
        continue
      }
      if (current === "}" && depth > 0) depth -= 1
      index += 1
      continue
    }
    if (closesScript(source, index)) return index
    if (current === "/") {
      finishWord(lexer)
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
      lexer.pendingBrace = false
      lexer.pendingNameBlock = false
      if (lexer.regexOk) {
        index = consumeRegex(source, index)
        lexer.regexOk = false
        lexer.context = "expr"
        lexer.word = ""
        continue
      }
      lexer.regexOk = true
      lexer.context = "expr"
      index += 1
      continue
    }
    if (current === "'" || current === '"') {
      finishWord(lexer)
      quote = current
      state = "string"
      index += 1
      continue
    }
    if (current === "`") {
      finishWord(lexer)
      state = "template"
      depth = 0
      index += 1
      continue
    }
    if (/[A-Za-z0-9_$]/u.test(current)) {
      lexer.word += current
      index += 1
      continue
    }
    noteSymbol(lexer, current, source[index - 1] ?? "", source[index - 2] ?? "", next)
    index += 1
  }
  return source.length
}

const javaScriptRanges = (extension, source) => {
  if (!markupExtensions.has(extension)) return null
  const ranges = []
  if (extension === ".astro" && source.startsWith("---")) {
    const fence = source.indexOf("\n---", 3)
    if (fence !== -1) ranges.push([source.indexOf("\n") + 1, fence])
  }
  const open = /<script\b[^>]*>/giu
  let match = open.exec(source)
  while (match) {
    const inFrontmatter = ranges.some((range) => match.index >= range[0] && match.index < range[1])
    if (!inFrontmatter) {
      const contentStart = match.index + match[0].length
      const contentEnd = readScriptEnd(source, contentStart)
      ranges.push([contentStart, contentEnd])
      const close = /<\/script\s*>/iu.exec(source.slice(contentEnd))
      open.lastIndex = close ? contentEnd + close.index + close[0].length : source.length
    }
    match = open.exec(source)
  }
  return ranges
}

export const requiredComments = []

const isRequired = (filename, line) =>
  requiredComments.some((entry) => entry.path === filename && (entry.line === undefined || entry.line === line))

const blankLiterals = (source, ranges) => {
  const chars = source.split("")
  let state = "code"
  let quote = ""
  const expressionDepths = []
  const lexer = createLexer()
  let inJavaScript = false
  let markupDepth = 0
  let index = 0
  while (index < chars.length) {
    const inRange = covers(ranges, index)
    if (!inRange && markupDepth === 0) {
      if (chars[index] === "{") {
        markupDepth = 1
        resetLexer(lexer)
        lexer.regexOk = true
        lexer.context = "expr"
        state = "code"
        quote = ""
        expressionDepths.length = 0
        index += 1
        continue
      }
      index += 1
      continue
    }
    if (inRange !== inJavaScript) {
      inJavaScript = inRange
      state = "code"
      quote = ""
      expressionDepths.length = 0
      if (inRange) resetLexer(lexer)
    }
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
        finishModuleString(lexer)
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
        finishModuleString(lexer)
        index += 1
        continue
      }
      if (current === "$" && next === "{") {
        chars[index] = " "
        chars[index + 1] = " "
        expressionDepths.push(1)
        state = "code"
        lexer.regexOk = true
        lexer.context = "expr"
        lexer.word = ""
        index += 2
        continue
      }
      chars[index] = " "
      index += 1
      continue
    }
    if (current === "/") {
      finishWord(lexer)
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
      lexer.pendingBrace = false
      lexer.pendingNameBlock = false
      if (lexer.regexOk) {
        const after = consumeRegex(chars, index)
        for (let cursor = index; cursor < after; cursor += 1) {
          if (chars[cursor] !== "\n") chars[cursor] = " "
        }
        index = after
        lexer.regexOk = false
        lexer.context = "expr"
        lexer.word = ""
        continue
      }
      lexer.regexOk = true
      lexer.context = "expr"
      index += 1
      continue
    }
    if (current === "'" || current === '"') {
      finishWord(lexer)
      quote = current
      state = "string"
      chars[index] = " "
      index += 1
      continue
    }
    if (current === "`") {
      finishWord(lexer)
      state = "template"
      chars[index] = " "
      index += 1
      continue
    }
    if (expressionDepths.length > 0 && current === "}") {
      expressionDepths[expressionDepths.length - 1] -= 1
      if (expressionDepths[expressionDepths.length - 1] === 0) {
        expressionDepths.pop()
        state = "template"
        chars[index] = " "
        index += 1
        continue
      }
    }
    if (/[A-Za-z0-9_$]/u.test(current)) {
      lexer.word += current
      index += 1
      continue
    }
    noteSymbol(lexer, current, chars[index - 1] ?? "", chars[index - 2] ?? "", next)
    if (expressionDepths.length > 0 && current === "{") expressionDepths[expressionDepths.length - 1] += 1
    else if (markupDepth > 0 && current === "{") markupDepth += 1
    else if (markupDepth > 0 && current === "}") markupDepth -= 1
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

const directiveLines = (source, ranges) => {
  const lines = blankLiterals(source, ranges).split("\n")
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

const styleCommentLines = (source, ranges) => {
  const chars = blankLiterals(source, ranges).split("")
  if (ranges !== null) {
    for (const range of ranges) {
      for (let index = range[0]; index < range[1] && index < chars.length; index += 1) {
        if (chars[index] !== "\n") chars[index] = " "
      }
    }
  }
  const visible = chars.join("")
  const found = []
  const open = /<style\b[^>]*>/giu
  let match = open.exec(visible)
  while (match) {
    const block = readStyleBlock(source, match.index + match[0].length)
    found.push(...block.comments)
    if (block.after === -1) break
    open.lastIndex = block.after
    match = open.exec(visible)
  }
  return found
}

const htmlCommentLines = (source, ranges) => {
  const chars = blankJavaScriptComments(blankLiterals(source, ranges)).split("")
  if (ranges !== null) {
    for (const range of ranges) {
      for (let index = range[0]; index < range[1] && index < chars.length; index += 1) {
        if (chars[index] !== "\n") chars[index] = " "
      }
    }
  }
  const withoutJsComments = chars.join("")
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

const expressionCommentLines = (source, ranges) => {
  const text = blankLiterals(source, ranges)
  const found = []
  let line = 1
  let index = 0
  while (index < text.length) {
    if (text[index] === "\n") {
      line += 1
      index += 1
      continue
    }
    if (text[index] !== "{" || covers(ranges, index)) {
      index += 1
      continue
    }
    let depth = 1
    let cursor = index + 1
    let commentLine = line
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === "\n") {
        commentLine += 1
        cursor += 1
        continue
      }
      if (text.startsWith("/*", cursor) || text.startsWith("//", cursor)) found.push(commentLine)
      if (text[cursor] === "{") depth += 1
      if (text[cursor] === "}") depth -= 1
      cursor += 1
    }
    index = cursor
    line = commentLine
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

const styleAttributeCommentLines = (source, ranges) => {
  const found = []
  let state = "code"
  let quote = ""
  const lexer = createLexer()
  const expressionDepths = []
  let inJavaScript = false
  let markupDepth = 0
  let index = 0
  while (index < source.length) {
    const covered = covers(ranges, index)
    const inExpression = covered || markupDepth > 0
    if (covered !== inJavaScript) {
      inJavaScript = covered
      if (state === "string" || state === "template" || state === "line" || state === "block") state = "code"
      if (covered) resetLexer(lexer)
    }
    const current = source[index]
    const next = source[index + 1]
    if (current === "\n") {
      if (state === "string" || state === "line") state = "code"
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
    if (state === "line") {
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
      if (state === "template" && current === "$" && next === "{") {
        expressionDepths.push(1)
        state = "code"
        lexer.regexOk = true
        lexer.context = "expr"
        lexer.word = ""
        index += 2
        continue
      }
      if ((state === "string" && current === quote) || (state === "template" && current === "`")) {
        state = "code"
        finishModuleString(lexer)
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
        lexer.regexOk = false
        lexer.context = "expr"
        lexer.word = ""
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
    if (!inExpression) {
      if (current === "{") {
        markupDepth = 1
        resetLexer(lexer)
        lexer.regexOk = true
        lexer.context = "expr"
        state = "code"
        quote = ""
        expressionDepths.length = 0
        index += 1
        continue
      }
      if (startsTag(source, index)) {
        state = "tag"
        index += 1
        continue
      }
      index += 1
      continue
    }
    if (expressionDepths.length > 0 && current === "}") {
      expressionDepths[expressionDepths.length - 1] -= 1
      if (expressionDepths[expressionDepths.length - 1] === 0) {
        expressionDepths.pop()
        state = "template"
        index += 1
        continue
      }
    }
    if (current === "/") {
      finishWord(lexer)
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
      lexer.pendingBrace = false
      lexer.pendingNameBlock = false
      if (lexer.regexOk) {
        index = consumeRegex(source, index)
        lexer.regexOk = false
        lexer.context = "expr"
        lexer.word = ""
        continue
      }
      lexer.regexOk = true
      lexer.context = "expr"
      index += 1
      continue
    }
    if (startsTag(source, index)) {
      finishWord(lexer)
      state = "tag"
      lexer.word = ""
      index += 1
      continue
    }
    if (current === "'" || current === '"') {
      finishWord(lexer)
      quote = current
      state = "string"
      index += 1
      continue
    }
    if (current === "`") {
      finishWord(lexer)
      state = "template"
      index += 1
      continue
    }
    if (/[A-Za-z0-9_$]/u.test(current)) {
      lexer.word += current
      index += 1
      continue
    }
    noteSymbol(lexer, current, source[index - 1] ?? "", source[index - 2] ?? "", next)
    if (expressionDepths.length > 0 && current === "{") expressionDepths[expressionDepths.length - 1] += 1
    else if (markupDepth > 0 && current === "{") markupDepth += 1
    else if (markupDepth > 0 && current === "}") markupDepth -= 1
    index += 1
  }
  return found
}

export const scanSource = (filename, source) => {
  const extension = path.extname(filename).toLowerCase()
  const ranges = javaScriptRanges(extension, source)
  const hits = []
  const push = (line, message) => {
    if (isRequired(filename, line)) return
    hits.push(`${filename}:${line}: ${message}`)
  }
  if (directiveExtensions.has(extension)) {
    for (const line of directiveLines(source, ranges)) push(line, suppressionMessage)
  }
  if (extension === ".css") {
    for (const line of unique(cssCommentLines(source))) push(line, commentMessage)
  }
  if (extension === ".yml" || extension === ".yaml") {
    for (const line of yamlCommentLines(source)) push(line, commentMessage)
  }
  if (markupExtensions.has(extension)) {
    for (const line of unique(htmlCommentLines(source, ranges))) push(line, commentMessage)
    for (const line of unique(styleCommentLines(source, ranges))) push(line, commentMessage)
    for (const line of unique(expressionCommentLines(source, ranges))) push(line, commentMessage)
  }
  if (styleAttributeExtensions.has(extension)) {
    for (const line of unique(styleAttributeCommentLines(source, ranges))) push(line, commentMessage)
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

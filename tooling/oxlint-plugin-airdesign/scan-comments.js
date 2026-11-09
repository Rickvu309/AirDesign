import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const suppressionMessage =
  "Remove this suppression. eslint-disable and oxlint-disable are comments, and comments are not allowed."
const commentMessage = "Remove this comment."

const directivePattern = new RegExp("(?:eslint-disable|oxlint-disable)\\b", "u")
const commentMarkPattern = new RegExp("//|/\\*|\\*/", "u")

const directiveExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".cts", ".mts", ".astro"])
const scannedExtensions = new Set([...directiveExtensions, ".css", ".yml", ".yaml"])
const skipDirectories = new Set(["node_modules", "dist", ".astro", ".fixture-run"])

export const requiredComments = []

const isRequired = (filename, line) =>
  requiredComments.some((entry) => entry.path === filename && (entry.line === undefined || entry.line === line))

const blankLiterals = (source) => {
  const chars = source.split("")
  let state = "code"
  let quote = ""
  const expressionDepths = []
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
      if (current === quote) state = "code"
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
    if (current === "/" && next === "/") {
      state = "line"
      index += 2
      continue
    }
    if (current === "/" && next === "*") {
      state = "block"
      index += 2
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
    if (current === "\n") {
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
      if (current === "\\") {
        index += next === undefined ? 1 : 2
        continue
      }
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
    if (current === "\n") {
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
      if (current === "\\") {
        index += next === undefined ? 1 : 2
        continue
      }
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
  if (extension === ".astro") {
    for (const line of unique(htmlCommentLines(source))) push(line, commentMessage)
    for (const line of unique(styleCommentLines(source))) push(line, commentMessage)
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

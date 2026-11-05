import ts from "typescript"

export type CommentHit = {
  line: number
  text: string
}

export function commentHits(fileName: string, source: string): CommentHit[] {
  if (fileName.endsWith(".css")) {
    return cssCommentHits(source)
  }
  const kind = scriptKind(fileName)
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind)
  const text = sourceFile.getFullText()
  const seen = new Set<number>()
  const hits: CommentHit[] = []
  const addRange = (range: ts.CommentRange | undefined) => {
    if (!range || seen.has(range.pos)) {
      return
    }
    seen.add(range.pos)
    const position = sourceFile.getLineAndCharacterOfPosition(range.pos)
    hits.push({ line: position.line + 1, text: text.slice(range.pos, range.end) })
  }
  const addRanges = (ranges: readonly ts.CommentRange[] | undefined) => {
    if (!ranges) {
      return
    }
    for (const range of ranges) {
      addRange(range)
    }
  }
  const visit = (node: ts.Node) => {
    addRanges(ts.getLeadingCommentRanges(text, node.pos))
    addRanges(ts.getTrailingCommentRanges(text, node.end))
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  const scan = scanCommentsOutsideStrings(source)
  for (const hit of scan) {
    if (!hits.some((item) => item.line === hit.line && item.text === hit.text)) {
      hits.push(hit)
    }
  }
  return hits
}

function scriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith(".tsx")) {
    return ts.ScriptKind.TSX
  }
  if (fileName.endsWith(".jsx")) {
    return ts.ScriptKind.JSX
  }
  if (fileName.endsWith(".mjs") || fileName.endsWith(".js")) {
    return ts.ScriptKind.JS
  }
  return ts.ScriptKind.TS
}

function scanCommentsOutsideStrings(source: string): CommentHit[] {
  const hits: CommentHit[] = []
  let line = 1
  let index = 0
  let mode = "code"
  const templateDepth: number[] = []
  while (index < source.length) {
    const current = source[index] ?? ""
    const next = source[index + 1] ?? ""
    if (current === "\n") {
      line += 1
      if (mode === "line") {
        mode = "code"
      }
      index += 1
      continue
    }
    if (mode === "line") {
      index += 1
      continue
    }
    if (mode === "block") {
      if (current === "*" && next === "/") {
        mode = "code"
        index += 2
        continue
      }
      index += 1
      continue
    }
    if (mode === "single" || mode === "double" || mode === "template") {
      if (current === "\\") {
        index += 2
        continue
      }
      if (mode === "template" && current === "$" && next === "{") {
        templateDepth.push(templateDepth.length)
        mode = "code"
        index += 2
        continue
      }
      const quote = mode === "single" ? "'" : mode === "double" ? "\"" : "`"
      if (current === quote) {
        mode = "code"
      }
      index += 1
      continue
    }
    if (current === "/" && next === "/") {
      const start = index
      const startLine = line
      index += 2
      while (index < source.length && source[index] !== "\n") {
        index += 1
      }
      hits.push({ line: startLine, text: source.slice(start, index) })
      continue
    }
    if (current === "/" && next === "*") {
      const start = index
      const startLine = line
      index += 2
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") {
          line += 1
        }
        index += 1
      }
      index = Math.min(source.length, index + 2)
      hits.push({ line: startLine, text: source.slice(start, index) })
      mode = "code"
      continue
    }
    if (current === "'") {
      mode = "single"
      index += 1
      continue
    }
    if (current === "\"") {
      mode = "double"
      index += 1
      continue
    }
    if (current === "`") {
      mode = "template"
      index += 1
      continue
    }
    if (current === "}" && templateDepth.length > 0) {
      templateDepth.pop()
      mode = "template"
    }
    index += 1
  }
  return hits
}

function cssCommentHits(source: string): CommentHit[] {
  const hits: CommentHit[] = []
  let line = 1
  let index = 0
  let quote: "'" | "\"" | null = null
  while (index < source.length) {
    const current = source[index] ?? ""
    const next = source[index + 1] ?? ""
    if (current === "\n") {
      line += 1
      index += 1
      continue
    }
    if (quote) {
      if (current === "\\") {
        index += 2
        continue
      }
      if (current === quote) {
        quote = null
      }
      index += 1
      continue
    }
    if (current === "'" || current === "\"") {
      quote = current
      index += 1
      continue
    }
    if (current === "/" && next === "*") {
      const start = index
      const startLine = line
      index += 2
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") {
          line += 1
        }
        index += 1
      }
      index = Math.min(source.length, index + 2)
      hits.push({ line: startLine, text: source.slice(start, index) })
      continue
    }
    index += 1
  }
  return hits
}

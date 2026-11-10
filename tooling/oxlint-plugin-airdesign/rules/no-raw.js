const hexDigit = (char) => {
  const code = char ? char.charCodeAt(0) : 0
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102)
}

const word = (char) => {
  const code = char ? char.charCodeAt(0) : 0
  return hexDigit(char) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 45 || code === 95
}

const allowsHex = (filename) => {
  const name = String(filename).replaceAll("\\", "/")
  if (name.endsWith("packages/theme/src/tokens.css")) return true
  const base = name.slice(name.lastIndexOf("/") + 1)
  const dot = base.lastIndexOf(".")
  return (dot === -1 ? base : base.slice(0, dot)).endsWith("-art")
}

const at = (source, index) => {
  const line = source.slice(0, index).split("\n").length
  const column = index - source.lastIndexOf("\n", index - 1)
  return { line, column }
}

const banned = "transition-" + "all"
const hexMessage = "Use a theme token instead of a raw hex."
const motionMessage = "Name the properties that change."

export const rawFindings = (filename, source) => {
  const findings = []
  if (!allowsHex(filename)) {
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] !== "#" || hexDigit(source[index - 1])) continue
      let length = 0
      while (length < 8 && hexDigit(source[index + 1 + length])) length += 1
      if ((length !== 8 && length !== 6 && length !== 4 && length !== 3) || hexDigit(source[index + 1 + length])) {
        continue
      }
      findings.push({ ...at(source, index), message: hexMessage })
      index += length
    }
  }
  for (let index = source.indexOf(banned); index !== -1; index = source.indexOf(banned, index + banned.length)) {
    if (word(source[index - 1]) || word(source[index + banned.length])) continue
    findings.push({ ...at(source, index), message: motionMessage })
  }
  return findings
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Reject a raw hex outside the token file, and name transition properties." },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? ""
    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode?.()
        const source = sourceCode?.getText?.() ?? sourceCode?.text ?? ""
        for (const finding of rawFindings(filename, source)) {
          context.report({
            loc: {
              start: { line: finding.line, column: finding.column - 1 },
              end: { line: finding.line, column: finding.column },
            },
            message: finding.message,
          })
        }
      },
    }
  },
}

export default rule

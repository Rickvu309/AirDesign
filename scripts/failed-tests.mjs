const colors = /\u001b\[[0-9;]*m/g
const githubPrefix = /^(?:[^\t\n]*\t[^\t\n]*\t)?﻿?\d{4}-\d\d-\d\dT[\d:.]+Z ?/

export const plainLog = (text) =>
  text
    .split("\n")
    .map((line) => line.replace(githubPrefix, "").replace(colors, ""))
    .join("\n")

export const failedSteps = (text) => {
  const lines = [...plainLog(text).matchAll(/^failed: (.+)$/gm)]
  return lines.length === 0
    ? []
    : lines
        .at(-1)[1]
        .split(",")
        .map((step) => step.trim())
}

const nextError = (lines, from) =>
  lines
    .slice(from)
    .find((line) => line.trim() !== "")
    ?.trim() ?? ""

const vitestFailure = /^ FAIL\s+(?:\S+\s+)??(\S+\.(?:test|spec)\.\w+)(?: > (.+?))?(?: \[ .+ \])?\s*$/
const playwrightFailure = /^\s*\d+\) (\S+\.spec\.\w+):(\d+):\d+ › (.+?)[\s─]*$/
const designStatesFile = "tests/browser/design-states.spec.ts"
const quotedField = (key) => new RegExp(`"${key}": "([^"]*)"`)

const failureBlock = (lines, from) => {
  const block = []
  for (const line of lines.slice(from + 1)) {
    if (vitestFailure.test(line) || playwrightFailure.test(line) || /^failed: /.test(line)) break
    block.push(line)
  }
  return block
}

const designStatesIn = (lines) => {
  const states = []
  let error
  for (const line of lines) {
    const found = quotedField("error").exec(line)
    const page = quotedField("page").exec(line)
    if (found !== null) error = found[1]
    if (page !== null) {
      states.push({ state: page[1], error })
      error = undefined
    }
  }
  return states
}

export const failedTests = (text) => {
  const lines = plainLog(text).split("\n")
  const found = new Map()
  lines.forEach((line, at) => {
    const vitest = vitestFailure.exec(line)
    const playwright = playwrightFailure.exec(line)
    const [file, name, lineNumber] =
      vitest !== null
        ? [vitest[1], vitest[2], undefined]
        : playwright !== null
          ? [playwright[1], playwright[3], Number(playwright[2])]
          : []
    if (file === undefined) return
    const headline = nextError(lines, at + 1)
    const states = file === designStatesFile ? designStatesIn(failureBlock(lines, at)) : []
    const tests =
      states.length === 0
        ? [
            {
              file,
              name: name ?? "(the whole file)",
              error: headline,
              ...(lineNumber === undefined ? {} : { line: lineNumber }),
            },
          ]
        : states.map((state) => ({
            file,
            name: name ?? "(the whole file)",
            state: state.state,
            error: state.error ?? headline,
            ...(lineNumber === undefined ? {} : { line: lineNumber }),
          }))
    for (const test of tests) {
      const key = `${file}:${test.line ?? ""} ${test.name} ${test.state ?? ""}`
      if (!found.has(key)) found.set(key, test)
    }
  })
  return [...found.values()]
}

const marker = /^(?:ok|fail|warn|start) \S/
const scriptFailure = /^fail (\S+\.(?:test\.mjs|js))$/
const stepFailure = /^fail ([a-z][a-z:-]*) [\d.]+s$/
const thrownError = /^(?:Uncaught )?\w*Error(?: \[\w+\])?: /
const stackNoise =
  /^(?:\s+at |\s*\^+\s*$|Node\.js v|node:internal|file:\/\/|\s+throw |\s+triggerUncaughtException|\s*[+-] (?:actual|expected))/

const blockBefore = (lines, at) => {
  let from = at - 1
  while (from >= 0 && !marker.test(lines[from])) from -= 1
  return lines.slice(from + 1, at).filter((line) => line.trim() !== "")
}

export const failedScripts = (text) => {
  const lines = plainLog(text).split("\n")
  return lines.flatMap((line, at) => {
    const file = scriptFailure.exec(line)?.[1]
    if (file === undefined) return []
    const block = blockBefore(lines, at)
    const error =
      block.findLast((each) => thrownError.test(each)) ?? block.findLast((each) => !stackNoise.test(each)) ?? ""
    return [{ file, name: "(the whole file)", error: error.trim() }]
  })
}

const causeLimit = 3
const specificCauses = [
  /(\S+\(\d+,\d+\): error TS\d+: .+)$/,
  /::error [^\n]*?::(.+)$/,
  /^(Error: Process from config\.webServer was not able to start\..*)$/,
]
const resultNoise =
  /^(?:Product copy literals in tests: |\[ELIFECYCLE\]|Error: ERR_PNPM|\s*[×│]|\[WebServer\]|\$ |\S+ (?:build|lint|test)(?:\$|:)|Done$|Node\.js v)/

export const failedCauses = (text) => {
  const lines = plainLog(text).split("\n")
  return lines.flatMap((line, at) => {
    const step = stepFailure.exec(line)?.[1]
    if (step === undefined) return []
    const block = blockBefore(lines, at)
    const specific = block.flatMap((each) => {
      const found = specificCauses.map((pattern) => pattern.exec(each)?.[1]).find((match) => match !== undefined)
      return found === undefined ? [] : [found.trim()]
    })
    const named =
      specific.length > 0 ? specific : block.filter((each) => !resultNoise.test(each)).map((each) => each.trim())
    return named.length === 0
      ? []
      : [{ step, lines: named.slice(0, causeLimit), more: Math.max(0, named.length - causeLimit) }]
  })
}

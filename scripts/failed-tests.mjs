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
const playwrightFailure = /^\s+\d+\) (\S+\.spec\.\w+):(\d+):\d+ › (.+?)[\s─]*$/

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
    const test = {
      file,
      name: name ?? "(the whole file)",
      error: nextError(lines, at + 1),
      ...(lineNumber === undefined ? {} : { line: lineNumber }),
    }
    const key = `${file}:${test.line ?? ""} ${test.name}`
    if (!found.has(key)) found.set(key, test)
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

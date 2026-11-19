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
const playwrightFailure = /^\s+\d+\) (\S+\.spec\.\w+):(\d+):\d+ › (.+?)\s*$/

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

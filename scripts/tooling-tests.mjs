import { spawn } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { onCi } from "./check-steps.mjs"
import { cleanEnvironment } from "./test-environment.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export const toolingTests = (folder) => [
  "tooling/oxlint-plugin-airdesign/run-tests.js",
  ...readdirSync(path.join(folder, "scripts"))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => `scripts/${name}`),
]

export const ciSecondsLimit = 45

export const limitFor = (env) => (onCi(env) ? ciSecondsLimit : Number.POSITIVE_INFINITY)

export const timed = ({ test, status, output, seconds, limit }) =>
  seconds <= limit
    ? { test, status, output }
    : {
        test,
        status: status || 1,
        output: `${output}${test} ran ${seconds.toFixed(1)} s, over the limit of ${String(limit)} s. A process or timer it started is probably still open at its end.\n`,
      }

const runOne = (test, cwd, limit) =>
  new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(process.execPath, [test], { cwd, env: cleanEnvironment(process.env) })
    let output = ""
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    child.on("error", (error) => resolve({ test, status: 1, output: `${output}${error.message}\n` }))
    child.on("close", (status) =>
      resolve(timed({ test, status: status ?? 1, output, seconds: (Date.now() - started) / 1000, limit })),
    )
  })

export const runToolingTests = async (tests, { width = 4, cwd = root, limit = limitFor(process.env) } = {}) => {
  const results = []
  let next = 0
  const worker = async () => {
    while (next < tests.length) {
      const test = tests[next]
      next += 1
      results.push(await runOne(test, cwd, limit))
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, tests.length) }, worker))
  return results.sort((left, right) => tests.indexOf(left.test) - tests.indexOf(right.test))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const named = process.argv.slice(2)
  const results = await runToolingTests(named.length > 0 ? named : toolingTests(root))
  const failures = results.filter((result) => result.status !== 0)
  for (const failure of failures) {
    process.stderr.write(failure.output)
    console.error(`fail ${failure.test}`)
  }
  if (failures.length > 0) process.exit(1)
}

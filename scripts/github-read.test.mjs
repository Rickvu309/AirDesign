import { readWithRetry, statusOf, worthRetrying } from "./github-read.mjs"

const fail = (message) => {
  console.error(message)
  process.exit(1)
}
const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
const failure = (stderr) => Object.assign(new Error(`Command failed: gh api\n${stderr}`), { stderr })

const scripted = (answers) => {
  const calls = []
  const said = []
  const slept = []
  const run = (args) => {
    calls.push(args)
    const answer = answers[Math.min(calls.length, answers.length) - 1]
    if (answer instanceof Error) throw answer
    return answer
  }
  const read = readWithRetry({ run, sleep: (ms) => slept.push(ms), say: (line) => said.push(line), attempts: 3, pause: 2000 })
  return { read, calls, said, slept }
}

same("a 502 is read again", worthRetrying(failure("gh: Bad Gateway (HTTP 502)")), true)
same("a 404 is not", worthRetrying(failure("gh: Not Found (HTTP 404)")), false)
same("a 403 is not", worthRetrying(failure("gh: Forbidden (HTTP 403)")), false)
same("a non-JSON answer is read again", worthRetrying(failure("invalid character 'S' looking for beginning of value")), true)
same("the status is read from gh", statusOf(failure("gh: x (HTTP 503)")), 503)

const recovers = scripted([failure("invalid character 'S' looking for beginning of value"), failure("gh: x (HTTP 502)"), "{}"])
same("a read that recovers returns its answer", recovers.read(["repos/x"]), "{}")
same("it asked three times", recovers.calls.length, 3)
same("it paused between tries", recovers.slept, [2000, 2000])
same("every retry is said in the log", recovers.said.length, 2)
if (!recovers.said[0].includes("not JSON") || !recovers.said[1].includes("HTTP 502")) fail(`the log is vague: ${recovers.said}`)

const stuck = scripted([failure("gh: Bad Gateway (HTTP 502)")])
let thrown
try {
  stuck.read(["repos/x"])
} catch (error) {
  thrown = error
}
same("it stops after three tries", stuck.calls.length, 3)
if (!thrown?.message.startsWith("could not read the pull request from GitHub") || !thrown.message.includes("HTTP 502"))
  fail(`the final message is not plain: ${thrown?.message}`)
if (thrown.message.includes("invalid character")) fail("a parse error leaks out")

const garbage = scripted([failure("invalid character 'S' looking for beginning of value")])
try {
  garbage.read(["repos/x"])
} catch (error) {
  if (!error.message.startsWith("could not read the pull request from GitHub") || !error.message.includes("not JSON"))
    fail(`a non-JSON answer is not named: ${error.message}`)
}

const missing = scripted([failure("gh: Not Found (HTTP 404)")])
try {
  missing.read(["repos/x"])
  fail("a 404 returned")
} catch (error) {
  same("a 404 is thrown at once, untouched", [missing.calls.length, String(error.stderr).includes("HTTP 404")], [1, true])
}

console.log("github read tests passed")

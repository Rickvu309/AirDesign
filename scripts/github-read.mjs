import { execFileSync } from "node:child_process"

const stderrOf = (error) => String(error.stderr ?? error.message ?? "").trim()

export const statusOf = (error) => {
  const code = stderrOf(error).match(/HTTP (\d{3})/)?.[1]
  return code === undefined ? undefined : Number(code)
}

const notJson = (text) =>
  /invalid character|unexpected end of JSON|looking for beginning of value|unexpected EOF/i.test(text)
const dropped = (text) => /ETIMEDOUT|ECONNRESET|EAI_AGAIN|timeout|connection (reset|refused)|\bEOF\b/i.test(text)

export const worthRetrying = (error) => {
  const status = statusOf(error)
  if (status !== undefined) return status >= 500
  const text = stderrOf(error)
  return notJson(text) || dropped(text)
}

export const pauseFor = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)

export const readWithRetry = ({
  run,
  sleep = pauseFor,
  say = (line) => console.error(line),
  attempts = 3,
  pause = 2000,
}) => {
  const read = (args) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return run(args)
      } catch (error) {
        if (!worthRetrying(error)) throw error
        const status = statusOf(error)
        const seen = status === undefined ? "an answer that was not JSON" : `HTTP ${status}`
        if (attempt >= attempts) {
          const failure = new Error(
            `could not read the pull request from GitHub: ${seen} on all ${attempts} tries (${stderrOf(error)})`,
          )
          failure.stderr = stderrOf(error)
          throw failure
        }
        say(
          `GitHub answered with ${seen}. Trying again in ${pause / 1000} seconds (try ${attempt + 1} of ${attempts}).`,
        )
        sleep(pause)
      }
    }
  }
  return read
}

export const ghApi = (args) =>
  execFileSync("gh", ["api", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  })

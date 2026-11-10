import { runBootstrap } from "./provision.js"

process.exitCode = await runBootstrap(process.env, (stream, line) => {
  process[stream].write(`${line}\n`)
})

import { runSetup } from "./platform/provision.js"

process.exitCode = await runSetup(process.env, (stream, line) => {
  process[stream].write(`${line}\n`)
})

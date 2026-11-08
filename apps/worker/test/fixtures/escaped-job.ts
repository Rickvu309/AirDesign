import { execFileSync } from "node:child_process"
import path from "node:path"

const directory = process.cwd()
const marker = process.env.AIRDESIGN_TEST_MARKER
execFileSync("python3", ["-c", `
import os
if os.fork(): os._exit(0)
os.setsid()
if os.fork(): os._exit(0)
with open(${JSON.stringify(path.join(directory, "descendant"))}, "w") as output: output.write(str(os.getpid()))
os.execve("/usr/bin/sleep", ["sleep", "300"], ${marker ? `{"AIRDESIGN_JOB_DIRECTORY": ${JSON.stringify(marker)}}` : "{}"})
`], { stdio: "ignore" })
if (process.env.AIRDESIGN_TEST_ACTION === "cpu") {
  execFileSync("prlimit", [`--pid=${process.pid}`, "--cpu=1:2"])
  for (;;) Math.sqrt(Math.random())
} else if (process.env.AIRDESIGN_TEST_ACTION === "normal") process.exit(0)
else setInterval(() => {}, 1000)

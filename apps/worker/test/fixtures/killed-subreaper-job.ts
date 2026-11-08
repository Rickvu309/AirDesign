import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { setTimeout } from "node:timers/promises"

execFileSync("env", ["-i", "python3", "-c", `
import os
if os.fork(): os._exit(0)
os.setsid()
if os.fork(): os._exit(0)
with open("descendant", "w") as output: output.write(str(os.getpid()))
os.execve("/usr/bin/sleep", ["sleep", "300"], {})
`], { stdio: "ignore" })
while (!existsSync("attack")) await setTimeout(10)
const fields = readFileSync(`/proc/${process.ppid}/stat`, "utf8").split(") ")[1]?.split(" ")
const root = Number(fields?.[1])
if (!(root > 1)) throw new Error("missing-test-subreaper")
process.kill(root, "SIGKILL")
setInterval(() => {}, 1000)

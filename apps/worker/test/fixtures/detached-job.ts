import { spawn, execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import path from "node:path"

const directory = process.env.AIRDESIGN_JOB_DIRECTORY ?? process.cwd()
const descendant = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" })
descendant.unref()
writeFileSync(path.join(directory, "descendant"), String(descendant.pid))
const action = process.argv[2] === "cpu" ? "cpu" : process.env.AIRDESIGN_TEST_ACTION
if (action === "cpu") {
  execFileSync("prlimit", [`--pid=${process.pid}`, "--cpu=1:2"])
  for (;;) Math.sqrt(Math.random())
} else if (action === "crash") process.kill(process.pid, "SIGSEGV")
else if (action === "normal") process.exit(0)
else setInterval(() => {}, 1000)

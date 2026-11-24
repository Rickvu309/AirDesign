import { execFileSync, spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { broadKills, killFault } from "./broad-kill.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const K = "kil" + "l"
const planted = [
  "p" + K + " -f playwright",
  K + "all node",
  "pgrep -f vite | xargs " + K + " -9",
  'ps -eo pid,args | awk "/playwright/ {print \\$1}" | xargs -r /bin/' + K,
  "ps aux | grep vite | xargs -r -n 1 -I {} /usr/bin/" + K + " -9 {}",
  K + " $(pgrep -f vite)",
  "  " + K + " -9 `pgrep node`",
  "/usr/bin/p" + K + " -f node",
  "sudo /usr/bin/" + K + "all -9 node",
  "true && p" + K + " node",
  "lsof -t -i :4485 | xargs " + K,
  "sudo -u root /usr/bin/p" + K + " -f node",
  "ps|xargs -r /bin/" + K,
  K + " $(/usr/bin/pgrep -f vite)",
]
for (const line of planted) {
  same(`${line} is caught`, broadKills([{ file: "a.sh", text: `echo hi\n${line}\n` }]), [
    { file: "a.sh", line: 2, text: line },
  ])
}
const harmless = [
  "Never use p" + K + " to clean up browser tests.",
  "# Never invoke " + K + "all for this server.",
  "printf '%s\\n' \"$owned_child_pid\" | xargs " + K,
  "Stop it with `p" + K + "` only never.",
  "process." + K + "(child.pid)",
  K + " " + "$child_pid",
  "echo ok # example; p" + K + " -f vite",
  "ps aux >/dev/null; printf '%s\\n' \"$owned_child_pid\" | xargs " + K,
  "echo 'a # b' && printf '%s\\n' \"$owned_child_pid\" | xargs " + K,
]
for (const line of harmless) same(`${line} is not caught`, broadKills([{ file: "a.md", text: `${line}\n` }]), [])
same("a pid kill is fine", broadKills([{ file: "a.mjs", text: "process.kill(child.pid, 'SIGTERM')\n" }]), [])
same("no fault when nothing is found", killFault([]), undefined)
if (!killFault([{ file: "a.sh", line: 2, text: "" }]).includes("verify-airdesign stop")) {
  throw new Error("the message names the safe command")
}

const root = mkdtempSync(path.join(os.tmpdir(), "broad-kill-"))
process.on("exit", () => rmSync(root, { recursive: true, force: true }))
mkdirSync(path.join(root, "scripts"))
copyFileSync(new URL("broad-kill.mjs", import.meta.url), path.join(root, "scripts/broad-kill.mjs"))
const git = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "ignore" })
git("init", "-q")
const run = () => spawnSync(process.execPath, [path.join(root, "scripts/broad-kill.mjs")], { encoding: "utf8" })
writeFileSync(path.join(root, "clean.sh"), "echo ok\n")
same("a clean tree passes", run().status, 0)
writeFileSync(path.join(root, "cleanup.sh"), `${planted[0]}\n`)
const failed = run()
same("a planted line fails the check", failed.status, 1)
if (!failed.stderr.includes("cleanup.sh:1") || !failed.stderr.includes("verify-airdesign stop")) {
  throw new Error(`the message names the line and the safe command: ${failed.stderr}`)
}

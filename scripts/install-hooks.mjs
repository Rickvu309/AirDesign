import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const hookFor = (name) =>
  [
    "#!/bin/sh",
    `script="$(git rev-parse --show-toplevel)/scripts/${name}.mjs"`,
    '[ -f "$script" ] || exit 0',
    'exec node "$script" "$@"',
    "",
  ].join("\n")

export const prePushHook = hookFor("pre-push")
export const preCommitHook = hookFor("pre-commit")

export const installHooks = (root) => {
  const common = path.resolve(
    root,
    execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" }).trim(),
  )
  const hook = path.join(common, "hooks", "pre-push")
  fs.mkdirSync(path.dirname(hook), { recursive: true })
  for (const [name, content] of [
    ["pre-push", prePushHook],
    ["pre-commit", preCommitHook],
  ]) {
    const target = path.join(common, "hooks", name)
    fs.writeFileSync(target, content, { mode: 0o755 })
    fs.chmodSync(target, 0o755)
  }
  return hook
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const onCi = process.env.CI === "true" || process.env.CI === "1"
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  if (!onCi && fs.existsSync(path.join(root, ".git"))) installHooks(root)
}

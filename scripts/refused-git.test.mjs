import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { refusedGit } from "./refused-git.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const kindOf = (command) => refusedGit(command)?.kind

for (const command of [
  "git commit -q --no-verify -m wip",
  "git commit -nm x",
  "git commit -n -m x",
  "git commit -qn -m x",
  "git commit -am wip --no-verify",
  "git commit --no-verif -m x",
  "git -C /home/quanvm/wt/elbow commit --no-verify -m 'base for before-after'",
  "git add -A && git commit --no-verify -m wip && git push",
  "cd /home/quanvm/wt/pdf && git add . && git commit -q -n -m tmp",
  "HUSKY=0 git commit --no-verify -m x",
  "env FOO=1 git commit --no-verify -m x",
  'bash -c "git commit --no-verify -m x"',
  "git -c core.hooksPath=/dev/null commit -m wip",
  "git -c core.hookspath=/dev/null commit -m wip",
  "cd /home/quanvm/tmp/g1-h3 && git add apps/web/src/commit-edit.test.ts && git commit -q --amend --no-edit --no-verify 2>&1 | tail -2; git log --oneline -1",
]) {
  same(`a commit that skips the hook is refused: ${command}`, kindOf(command), "commit")
}

for (const command of [
  "git push --no-verify",
  "git push --no-verify origin HEAD:refs/heads/shapes",
  "git push -u origin shapes --no-verify",
  "git -c core.hooksPath=/dev/null push",
]) {
  same(`a push that skips the hook is refused: ${command}`, kindOf(command), "push")
}

for (const command of [
  "git stash",
  "git stash pop",
  "git stash -u",
  "git stash push -m 'mine' -- apps/web",
  "cd x && git stash list",
  "git stash list | head",
  "git -C /home/quanvm/wt/shapes stash apply stash@{0}",
  "git status; git stash; git rebase origin/main; git stash pop",
  "out=$(git stash create)",
  "git fetch && (git stash && git pull)",
  "git stash show -p stash@{1}\n",
  'echo "$(git stash list)"',
  "git stash -q && git stash apply -q && git checkout origin/main -- src/editor/slide-menu.tsx",
  "git stash push -q packages/render/src/passage.tsx; uptime; git stash pop -q; git diff --stat",
  'git stash store -m "kept" 1f61382c02ad2c5597a5ba9be631df6458f62ca4',
  "git stash drop stash@{1} && git stash list | head -2",
]) {
  same(`a stash is refused: ${JSON.stringify(command)}`, kindOf(command), "stash")
}

for (const command of [
  'git commit -m "no-verify in text"',
  "git commit -m '--no-verify'",
  "git commit -m -n",
  "git commit -F msg.txt -q",
  "git commit -m \"$(cat <<'EOF'\nStop git stash and --no-verify\n\nEOF\n)\"",
  "git commit -F - <<'EOF'\nKeep git stash out\ngit commit --no-verify\nEOF\ngit log -1",
  "git push -n origin HEAD",
  "git push origin HEAD --dry-run",
  "rg stash",
  "rg -n -- --no-verify scripts",
  "git log --grep stash",
  "git log --grep=--no-verify",
  "echo git stash",
  "grep -rn 'git stash' AGENTS.md",
  "# git stash\ngit status",
  "git show HEAD:scripts/stash.mjs",
  "pnpm land --title 'Refuse git stash' --body-file body.md --no-follow",
  "git commit -m wip",
  "git -c user.name=fixture commit -q -m wip",
  "git checkout -b stash",
  'git commit -m "$(cat <<\'EOF\'\nRefuse "git commit -n" and "git stash" for agents\n\nEOF\n)"',
  "cat > brief.md <<'EOF'\n## Hard limits\n- No `--no-verify`. Keep work in progress as commits (the git stash is shared).\nEOF\necho ok",
  "git reflog refs/stash",
  "git diff 1f61382c^1 1f61382c",
  "",
]) {
  same(`a harmless command passes: ${JSON.stringify(command)}`, refusedGit(command), undefined)
}

const commit = refusedGit("git commit --no-verify -m wip")
same("a commit refusal names the hook and a wip commit", /git commit -m wip/.test(commit.message), true)
const push = refusedGit("git push --no-verify")
same("a push refusal names pnpm land", /pnpm land/.test(push.message), true)
const stash = refusedGit("git stash")
same("a stash refusal says every worktree shares the stash", /shares one `git stash`/.test(stash.message), true)
same("a stash refusal names the commit to keep work in", /git commit -m wip/.test(stash.message), true)
same("a stash refusal says how to read an old entry", /git reflog refs\/stash/.test(stash.message), true)

const hook = (input) =>
  spawnSync(process.execPath, [path.join(root, "scripts/refused-git.mjs")], {
    input: JSON.stringify(input),
    encoding: "utf8",
  })
const blocked = hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git stash" } })
same("the hook blocks with exit 2", blocked.status, 2)
same("the hook tells the agent why on stderr", blocked.stderr.includes("shares one"), true)
const allowed = hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git status" } })
same("the hook lets a harmless command through", [allowed.status, allowed.stdout, allowed.stderr], [0, "", ""])
same("the hook lets a call with no command through", hook({ tool_name: "Read", tool_input: {} }).status, 0)

const settings = JSON.parse(fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8"))
const bashHooks = settings.hooks.PreToolUse.filter(({ matcher }) => matcher === "Bash").flatMap(({ hooks }) => hooks)
same(
  "the project settings run this script before every Bash call",
  bashHooks.some(({ type, command }) => type === "command" && command.includes("scripts/refused-git.mjs")),
  true,
)

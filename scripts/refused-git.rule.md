# An agent never skips the commit or push hook and never uses the shared `git stash`

`scripts/refused-git.mjs` runs before every Bash call of a Claude Code agent (`.claude/settings.json`) and refuses `git commit --no-verify`/`-n`, `git push --no-verify`, a `core.hooksPath` override, and every `git stash` command, naming the supported way. Other harnesses meet the pre-push hook and `pnpm gate` for anything that ships

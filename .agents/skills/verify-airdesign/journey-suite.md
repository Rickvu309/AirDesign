# Journey suite

Run the shipped journeys from the repo root.

```sh
pnpm test:journeys
```

The command builds `@airdesign/api` and `apps/web` once. Playwright's global setup launches a stack with `$V launch --no-build` and teardown stops it. Journeys that sign in use their own account. The `landing-pages` journey opens the public site. Evidence lands under `~/tmp/verify-airdesign/<run>/`.

Full-suite runs need Poppler for `path-paint` and `path-seams`. Both use `pdftoppm`, and `path-seams` also uses `pdfimages`. The commands look on `PATH` first and then in `~/.cache/pptx-tools/usr/bin`.

Journeys run in parallel. The stack has one queue of recorded model streams, so journeys that call `kit.aira()` run one after another in a serial group in `tests/journeys/journeys.spec.ts`: `aira-panel` and `execute-agent` today. Tests never retry. Mark a known failure with `test.fail()` in the spec and remove the mark with the fix.

CI runs the journeys job on a pull request that affects journeys. It selects named journeys when the change map can name them and splits the full suite across two shards otherwise. See [COMMANDS.md](../../../COMMANDS.md) for the checks CI runs.

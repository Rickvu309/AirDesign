# A pull request's title, body and base change through `pnpm land`, never `gh pr edit`, which fails here with the Projects (classic) error

`pnpm land --title` and `--body-file` set an open pull request's title and body through the REST endpoint (`scripts/pull-edit.mjs`). `scripts/land.test.mjs` fails when a line land prints tells the agent to run `gh pr edit` or `gh pr create`

# Builds run serially: concurrent `tsc -b` writes leave shared declarations incomplete

`scripts/build-order.test.mjs` fails a `pnpm` command in `package.json` or a workflow that builds two projects with `--filter` and no `--workspace-concurrency=1`. The `journeys` build failed this way on main at a83f2535

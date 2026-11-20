# A PR is in the merge queue, not only believed to be

`pnpm land` reads the queue back and stops when the PR is neither queued nor armed (`scripts/merge-queue.mjs`)

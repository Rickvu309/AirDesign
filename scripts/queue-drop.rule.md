# A dropped queue entry is seen

While `main` has a merge queue, `pnpm land --watch` prints the queue run's failed tests and requeues only as a fresh run. The `queue-drop` job in `ci-failure-report.yml` comments on the dropped PR with failed jobs, steps, tests and run link, and queues nothing. With no queue nothing is dropped, and land reports the PR's own failed run (`queue-drop.test.mjs`, `queue-free.test.mjs`)

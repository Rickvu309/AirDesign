# A dropped queue entry is seen

`pnpm land --watch` prints the queue run's failed tests and requeues only as a fresh run. The `queue-drop` job in `ci-failure-report.yml` comments on the dropped PR with failed jobs, steps, tests and run link, and queues nothing (`queue-drop.test.mjs`)

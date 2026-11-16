# Isolation and load

- Every run has its own ports, Postgres cluster, scratch dir and evidence dir. Two runs, from two agents or two worktrees, do not see each other.
- The machine's cores are shared by many agents. Run one journey at a time, stop as soon as you have the proof, and do not run this while your own `pnpm check` runs.
- `launch` writes the load average into `proof.md`, and every journey's PASSED or FAILED line says the load it finished under. Quote it with a result: "passed at load 42 on 16 cores".
- `pnpm check` takes a machine lock; `$V suites --run` takes the same lock; the other commands do not.

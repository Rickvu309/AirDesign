# What enforces the check queue

The rules of the local check queue, the machine lock that `pnpm check`, `check:pptx`, `pnpm prove`, `pnpm land` and the verify-airdesign runs take on this machine. `CHECKS.md` holds every other rule.

| Rule | Enforced by |
| --- | --- |
| The check lane's wait is said | `takeMachineLock` prints the place and expected wait, and logs runs to `~/.cache/airdesign/check-queue.jsonl` |
| Full checks take one slot per 16 cores and 12 GB of memory, a slot past the first only while the load average is below the core count; a file from a failed `unit-tests` step can rerun alone without waiting behind them | `takeMachineLock` in `scripts/machine-lock.mjs` keeps two lanes: `full`, with the slots of `checkSlots`, for `pnpm check`, `check:pptx`, `suites --run` and paint fidelity, and `small` for land's alone rerun, which runs niced on two workers (`aloneRun` in `scripts/land-check.mjs`). Each queue row names its lane and status; `scripts/machine-lock.test.mjs` runs a small job beside a full check, queues two small jobs, runs two full checks in two slots while a third waits, and keeps the second slot shut while the load is above the core count |
| A branch with older queue code does not wait in line | `takeMachineLock` in `scripts/machine-lock.mjs` leaves a `lane-protocol-<n>` file in `~/.cache/airdesign` from `laneProtocol`, and a job whose `laneProtocol` is lower than the newest file there exits 1 before it takes a ticket and names `git fetch origin && git rebase origin/main`. A queue change that older code cannot share the folder with raises `laneProtocol`; review holds that. Branches made before the rule have no such check. `scripts/machine-lock.test.mjs` runs a check in a folder with a newer protocol file |

# The check lane's wait is said

`takeMachineLock` in `scripts/machine-lock.mjs` prints the place in line and the expected wait from recent runs, and appends each run to check-queue.jsonl in `~/.cache/airdesign`. `scripts/machine-lock.test.mjs` fails a wait that skips the checks ahead, a promised wait from an empty log, and a run the log left out.

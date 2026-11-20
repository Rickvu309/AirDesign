# A branch with older queue code does not wait in line

`takeMachineLock` in `scripts/machine-lock.mjs` leaves a `lane-protocol-<n>` file in `~/.cache/airdesign` from `laneProtocol`, and a job whose `laneProtocol` is lower than the newest file there exits 1 before it takes a ticket and names `git fetch origin && git rebase origin/main`. A queue change that older code cannot share the folder with raises `laneProtocol`; review holds that. Branches made before the rule have no such check. `scripts/machine-lock.test.mjs` runs a check in a folder with a newer protocol file

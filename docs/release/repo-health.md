# Repository maintenance

Run from the repository root with Python 3, Git and an authenticated GitHub CLI. Audit a merged PR first:

```sh
python3 -B scripts/repo/health.py after-merge 40
python3 -B scripts/repo/health.py after-merge 40 --apply
```

JSON lists each removed path and branch, every refusal, and process/filesystem visibility limits. The command obtains main from GitHub, checks ancestry and clean state, scans process cwd/open files and external symlinks, and reads current active T3 bindings from its read-only local database. Missing safety data refuses cleanup. Owner checkouts, evidence, known protected pins and safety branches remain protected. An ignored build directory may be removed with an otherwise safe worktree; reports must remain outside disposable worktrees.

Worktrees use ordinary `git worktree remove`; local branches use `git branch -d`. Remote deletion uses an exact-head lease so an advanced remote branch cannot be deleted accidentally. A retained worktree blocks branch deletion. A different local head, protected branch, active binding, or another open PR also blocks deletion. Already deleted branches are harmless. Nothing deploys or modifies main.

Wait for the actual main CI and Deploy conclusions for a full SHA:

```sh
python3 -B scripts/repo/health.py runs FULL_40_CHARACTER_SHA
```

The command waits up to one hour, selects main push CI and workflow-run Deploy for that exact SHA, and prints their run URLs, conclusions and failing job/step names. Exit 0 means both completed successfully; 1 means a real failure or query error; 124 means the deadline elapsed. A successful wait process is never substituted for a workflow conclusion. This is workflow status only; Release still owns live artifact and browser acceptance.

Agents should launch a requested wait once as a background command and collect its completion event. Do not build another polling loop around it. `--timeout 0` produces an immediate receipt without waiting.

The process audit is limited to readable command lines of all owners and cwd/file descriptors owned by the current user. Unreadable command lines are counted as no evidence. Known session daemons and zombies do not block on inaccessible cwd/descriptors; other same-user visibility gaps refuse deletion. Accessible filesystem symlinks are scanned outside virtual `/proc`, `/sys` and `/dev`; permission failures are recorded without privilege escalation.

# Land takes one fresh run for test failures outside the diff and records a race only after that run passes the failed jobs

Land compares the diff with the failed jobs through `scripts/change-map.mjs`. A pull request that can affect a failed job stops, even when it leaves the failed test file alone. Missing job logs and paths the map cannot place also stop. A change to a browser or journeys test or its setup takes no fresh run.

For named browser, design or journeys test failures the map rules out, land comments on the pull request and closes and reopens it, or queues it again after a queue drop. The comment marks the head and the failed run. A reopen selects every ci part so the failed jobs run again. Land files a `Race:` issue only when a fresh run on the same head passes ci and executes the failed jobs successfully. An unsuccessful fresh run stops for a fix. A merge-queue run on a different commit cannot confirm a race on the pull request head. `ci` fails attempts after the first.

# An unmerged closed pull request's branch is deleted; one reopened for its fresh run keeps it

`closed-branch` waits 60 seconds and deletes only if the pull request is still closed, never `main`, `green`, or `archive/` (`closed-branch.test.mjs`, PR 953)

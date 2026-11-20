# Planted faults on changed code are reported

the `mutation` job, which warns about survivors and blocks nothing. Stryker leaves every symlink git tracks out of its sandbox (`linkedPaths` in `scripts/check-mutation.mjs`), and a crash fails the job while a run that hits its time limit only warns (`scripts/ci-crashes.test.mjs`)

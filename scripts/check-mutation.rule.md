# Planted faults on changed code are reported

the `mutation` job, which warns about survivors and blocks nothing. Stryker leaves every symlink git tracks out of its sandbox (`linkedPaths` in `scripts/check-mutation.mjs`), and a crash fails the job while a run that hits a time limit, its own 30 minutes or Stryker's limit on the first run of the tests (`Initial test run timed out`), only warns (`scripts/ci-crashes.test.mjs` replays the exit codes and the job log of a run that timed out on its first run of the tests)

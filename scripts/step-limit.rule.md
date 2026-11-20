# A hung step cannot hold a check slot

`stepRunner` in `scripts/check.mjs` limits a local step (720 s for step `unit-tests`, 480 s otherwise), kills its group and fails it naming the command; `runCheck` runs the rest. `scripts/check-hung.test.mjs` checks the slot is free. ci sets none

# No script, doc or helper kills processes by name, so one agent's cleanup never kills another agent's test run

`scripts/broad-kill.mjs` fails `pnpm check` on a line that runs a by-name kill command or pipes a process search into a kill, and names `verify-airdesign stop <run>` as the safe command. `scripts/broad-kill.test.mjs` plants a line in a scratch repo and expects the failure

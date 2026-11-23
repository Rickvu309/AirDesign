# A rule about what a deck may hold lives in the Doom core, so a person, an agent and every later caller are refused alike, and no screen or tool repeats it before the write

`packages/doom/src/apply-edit.guards.test.ts` fails unless an edit that leaves the deck with no slide is refused `last-slide`, whoever sends it and however it removes the slides, and `packages/mcp/src/suite.ts` fails unless an agent's edit that deletes every slide gets that refusal in its answer

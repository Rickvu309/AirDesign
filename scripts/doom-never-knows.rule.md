# Doom knows geometry, the edit format and its guards; it never knows a host, words for a reader, or taste

The `doom-never-knows` step runs `scripts/doom-never-knows.mjs` as a warning against `packages/doom/src` outside tests, `packages/doom/src/testing/` and `packages/doom/src/sample-deck.ts`, held by a per-file ceiling in `scripts/doom-never-knows.json` that may only shrink relative to `origin/main`.

- host: a file or an export named for an agent, MCP, a tool, an answer, a prompt or a hint, and any `note` field. The author kind `"agent"` and a run's `agent` id stay: the run fence needs them.
- words: a string of three words or more. Doom answers with codes and numbers; the agent and the editor word them. A thrown `Error` and the preset geometry formulas are not words for a reader.
- taste: a colour, a title-case word such as `"Untitled"`, a data file of design values, or a `*Share` constant that places things on a slide. OpenType weight names are font facts.

`scripts/doom-never-knows.test.mjs` holds one case of each kind and each exception, plus the per-file ceiling rules.

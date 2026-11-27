# Hosts

What each agent host gives the model from one MCP tool answer, measured with `scripts/host-probe.mjs`. The probe has two tools. `slide_picture` answers a red picture and a text block, with `structuredContent` beside them, and `slide_note` answers a text block alone. Each part holds a word no other part holds, so the model's answer shows which parts reached it.

| Host                | Measured     | Image | Text beside structuredContent | structuredContent | Text alone |
| ------------------- | ------------ | ----- | ----------------------------- | ----------------- | ---------- |
| Claude Code 2.1.332 | 2026-11-27   | yes   | no                            | yes               | yes        |
| claude.ai           | not measured |       |                               |                   |            |
| Gemini app          | not measured |       |                               |                   |            |

## Claude Code

`node scripts/host-probe.mjs` runs `claude -p` against the probe, reads what the model received from the transcript, and rewrites the Claude Code row with the version and date.

## claude.ai and the Gemini app, by hand

These hosts reach a server only through a public URL and a person's account, so nothing here drives them.

1. `node scripts/host-probe.mjs serve` starts the probe on port 8787 and prints a tunnel command and the prompt.
2. Run the tunnel command and copy the `https://…trycloudflare.com` address it prints.
3. Add that address with `/mcp` on the end as a custom connector: in claude.ai under Settings, Connectors; in the Gemini app under Settings, Connected Apps, Custom apps. On a Claude Team plan an owner must allow custom connectors first.
4. In a new chat, send the printed prompt. The model answers with the picture's colour and the words it saw.
5. Fill the host's row: Image is yes when the colour is red. Each other column is yes when its word is in the answer: `ONLY-TEXT-plum`, `ONLY-STRUCTURED-fig`, `ONLY-ALONE-pear`. Write the date in Measured.

The Gemini app signs in to a connector with OAuth. If it refuses the probe because the probe has no sign-in, leave its row as not measured and write why.

import { spawnSync } from "node:child_process"
const corpus = spawnSync(process.execPath, ["scripts/verify-paragraph-corpus.mjs"], {stdio: "inherit"})
if (corpus.status !== 0) process.exit(corpus.status ?? 1)
const result = spawnSync("npx", ["vitest", "run", "packages/pptx/test/roundtrip.test.ts"], { stdio: "inherit" })
if (result.status !== 0) process.exit(result.status ?? 1)
const { libreOfficeFastCheck } = await import("../packages/pptx/test/libreoffice.ts")
const { default: os } = await import("node:os")
const receipt = await libreOfficeFastCheck("fixtures/pptx/preservation.pptx", `${os.homedir()}/tmp/airdesign-autopilot/P03/LibreOffice/verify`)
process.stdout.write(JSON.stringify({ libreOfficeFastCheck: receipt }) + "\n")

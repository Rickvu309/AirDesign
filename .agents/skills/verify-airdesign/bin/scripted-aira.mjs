import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export function scriptedAira({ Replay, repo, file, log }) {
  const replay = new Replay(new URL(`${pathToFileURL(path.join(repo, "apps/api/src/aira-streams")).href}/`))
  let played = ""
  return {
    on: true,
    key: "verify-key-not-real",
    secret: "verify-secret-not-real",
    log,
    transport: (call, key) => {
      const scripts = existsSync(file) ? readFileSync(file, "utf8") : played
      if (scripts !== played) replay.play(...JSON.parse(scripts).scripts)
      played = scripts
      return replay.transport(call, key)
    },
  }
}

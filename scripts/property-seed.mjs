import { createHash } from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export const commitVariable = "AIRDESIGN_PROPERTY_COMMIT"
export const replayVariable = "AIRDESIGN_PROPERTY_REPLAY"

export const propertySeed = ({ commit, file, test, index }) =>
  createHash("sha256")
    .update([commit, file, test, String(index)].join("\u0000"))
    .digest()
    .readInt32BE(0)

export const propertyParameters = ({ env, parameters, file = "", test = "", index }) => {
  if (env[replayVariable]) {
    const replay = JSON.parse(env[replayVariable])
    return { ...parameters, seed: replay.seed, path: replay.path, endOnFailure: true }
  }
  if (parameters.seed !== undefined || !env[commitVariable]) return parameters
  const relative = path.relative(root, file).split(path.sep).join("/")
  return { ...parameters, seed: propertySeed({ commit: env[commitVariable], file: relative, test, index }) }
}

export const propertyReplay = (excerpt) => {
  const found = /\{ seed: (-?\d+), path: "([\d:]+)"/.exec(excerpt)
  return found === null ? undefined : { seed: Number(found[1]), path: found[2] }
}

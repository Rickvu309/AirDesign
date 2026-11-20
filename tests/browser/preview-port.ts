import { createHash } from "node:crypto"

export const previewPortName = "AIRDESIGN_PREVIEW_PORT"

const firstPort = 4400
const hashedSlots = 600

export const startingPort = (checkout: string, env: NodeJS.ProcessEnv): number => {
  const asked = Number(env.AIRDESIGN_PORT)
  if (Number.isInteger(asked) && asked >= 1 && asked <= 65535) return asked
  return firstPort + (createHash("sha256").update(checkout).digest().readUInt16BE(0) % hashedSlots)
}

export const previewPortLine = (port: number): string => `airdesign preview port ${String(port)}`

export const previewPortPattern = new RegExp(`airdesign preview port (?<${previewPortName.toLowerCase()}>\\d+)`)

export const previewOrigin = (env: NodeJS.ProcessEnv): string | undefined =>
  env[previewPortName] === undefined ? undefined : `http://127.0.0.1:${env[previewPortName]}`

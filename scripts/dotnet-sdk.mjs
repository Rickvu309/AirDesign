import { execFileSync } from "node:child_process"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const dotnetCandidates = (env, home = os.homedir()) =>
  [
    { place: "PPTX_DOTNET", command: env.PPTX_DOTNET },
    { place: "dotnet on PATH", command: "dotnet" },
    { place: "$DOTNET_ROOT/dotnet", command: env.DOTNET_ROOT ? path.join(env.DOTNET_ROOT, "dotnet") : undefined },
    { place: "$HOME/.dotnet/dotnet", command: path.join(home, ".dotnet", "dotnet") },
  ].filter((candidate) => candidate.command)

export const hasSdk8 = (command) => {
  try {
    const listed = execFileSync(command, ["--list-sdks"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    return listed.split("\n").some((line) => line.startsWith("8."))
  } catch {
    return false
  }
}

export const findDotnet = (env, { home = os.homedir(), works = hasSdk8 } = {}) => {
  const candidates = dotnetCandidates(env, home)
  const found = candidates.find((candidate) => works(candidate.command))
  if (found) return { command: found.command }
  const tried = candidates.map((candidate) => `${candidate.place} (${candidate.command})`).join(", ")
  return {
    problem: `The PowerPoint check needs the .NET 8 SDK and found none. Tried: ${tried}. Install it with https://dot.net/v1/dotnet-install.sh --channel 8.0 (installs into $HOME/.dotnet), or set PPTX_DOTNET to the dotnet binary of an 8.x SDK.`,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const found = findDotnet(process.env)
  if (found.problem) {
    console.error(found.problem)
    process.exit(1)
  }
  console.log(found.command)
}

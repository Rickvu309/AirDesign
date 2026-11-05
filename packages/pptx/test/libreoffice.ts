import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"
import os from "node:os"

export async function libreOfficeFastCheck(input: string, directory: string, executable = process.env.AIRDESIGN_SOFFICE) {
  await mkdir(directory, { recursive: true })
  if (!executable) {
    const receipt = { status: "unavailable", reason: "AIRDESIGN_SOFFICE-unset", fidelity: "PowerPoint-unproven" }
    await writeFile(path.join(directory, "receipt.json"), JSON.stringify(receipt, null, 2))
    return receipt
  }
  const profile = await mkdtemp(path.join(os.homedir(), "tmp/airdesign-lo-profile-"))
  const args = [`-env:UserInstallation=${pathToFileURL(profile).href}`, "--convert-to", "pdf:impress_pdf_Export", "--outdir", directory, path.resolve(input)]
  const pdf = path.join(directory, path.basename(input, path.extname(input)) + ".pdf")
  await rm(pdf, { force: true })
  try {
    const execute = () => promisify(execFile)(executable, args, { timeout: 60_000, maxBuffer: 1024 * 1024 })
    const bootstrap: { code: number; stdout: string; stderr: string }[] = []
    const result = await execute().catch(error => {
      if (!(error instanceof Error) || !("code" in error) || error.code !== 81) throw error
      bootstrap.push({ code: 81, stdout: "stdout" in error ? String(error.stdout) : "", stderr: "stderr" in error ? String(error.stderr) : "" })
      return execute()
    })
    await writeFile(path.join(directory, "stdout.txt"), result.stdout)
    await writeFile(path.join(directory, "stderr.txt"), result.stderr)
    const bytes = await readFile(pdf)
    if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("libreoffice-pdf-required")
    const receipt = { status: "passed", bootstrap, executable, args, input: path.resolve(input), pdf, bytes: bytes.length, fidelity: "PowerPoint-unproven" }
    await writeFile(path.join(directory, "receipt.json"), JSON.stringify(receipt, null, 2))
    return receipt
  } catch (error) {
    const receipt = { status: "failed", executable, args, input, error: String(error), fidelity: "PowerPoint-unproven" }
    await writeFile(path.join(directory, "receipt.json"), JSON.stringify(receipt, null, 2))
    throw error
  } finally { await rm(profile, { recursive: true, force: true }) }
}

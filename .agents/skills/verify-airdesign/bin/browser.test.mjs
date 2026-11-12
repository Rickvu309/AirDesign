import { describe, expect, it } from "vitest"
import { launchProblem } from "./browser.mjs"

describe("launchProblem", () => {
  it("names the missing library and the exact library path to use on this machine", () => {
    const message =
      "browserType.launch: closed\n[err] chrome-headless-shell: error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file"
    expect(launchProblem(message)).toBe(
      "Chromium cannot start: libatk-1.0.so.0 is missing. On this machine run the command with LD_LIBRARY_PATH=~/.cache/chromium-libs/root/usr/lib/x86_64-linux-gnu",
    )
  })

  it("says how to install Chromium when it is absent", () => {
    expect(launchProblem("browserType.launch: Executable doesn't exist at /x")).toMatch(/playwright install chromium/)
  })
})

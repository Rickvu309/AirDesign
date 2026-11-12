import { describe, expect, it } from "vitest"
import { browserEnv, launchProblem, librariesDir } from "./browser.mjs"

describe("launchProblem", () => {
  it("names the missing library and the folder the commands read it from", () => {
    const message =
      "browserType.launch: closed\n[err] chrome-headless-shell: error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file"
    expect(launchProblem(message)).toBe(
      `Chromium cannot start: libatk-1.0.so.0 is missing. Unpack Chromium's libraries into ${librariesDir}; every verify-airdesign command and suite adds that folder to LD_LIBRARY_PATH when it exists.`,
    )
  })

  it("says how to install Chromium when it is absent", () => {
    expect(launchProblem("browserType.launch: Executable doesn't exist at /x")).toMatch(/playwright install chromium/)
  })
})

describe("browserEnv", () => {
  it("puts the library folder first when it exists on the machine", () => {
    expect(browserEnv({ LD_LIBRARY_PATH: "/opt/lib", HOME: "/h" }, "/libs", () => true)).toEqual({
      LD_LIBRARY_PATH: "/libs:/opt/lib",
      HOME: "/h",
    })
  })

  it("leaves the environment alone when the folder is absent or already listed", () => {
    const absent = { HOME: "/h" }
    expect(browserEnv(absent, "/libs", () => false)).toBe(absent)
    const listed = { LD_LIBRARY_PATH: "/libs" }
    expect(browserEnv(listed, "/libs", () => true)).toBe(listed)
  })
})

import { describe, expect, it } from "vitest"
import { browserEnv, launchProblem, librariesDir, openBrowser } from "./browser.mjs"

describe("launchProblem", () => {
  it("names the missing library and the folder the commands read it from", () => {
    const message =
      "browserType.launch: closed\n[err] chrome-headless-shell: error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file"
    expect(launchProblem(message)).toBe(
      `Chromium cannot start: libatk-1.0.so.0 is missing. Unpack Chromium's libraries into ${librariesDir}; every verify-airdesign command and suite, pnpm test:browser and pnpm test:journeys add that folder to LD_LIBRARY_PATH when it exists.`,
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

describe("openBrowser", () => {
  it("launches with the library folder on the environment it is given", async () => {
    const browser = {}
    let given
    const opened = await openBrowser(
      async (options) => {
        given = options
        return browser
      },
      { HOME: "/h" },
      "/libs",
      () => true,
    )
    expect(opened).toBe(browser)
    expect(given).toEqual({ env: { HOME: "/h", LD_LIBRARY_PATH: "/libs" } })
  })

  it("stops with the library message when Chromium cannot load one", async () => {
    const launch = async () => {
      throw new Error(
        "browserType.launch: closed\n[err] chrome: error while loading shared libraries: libatk-1.0.so.0: cannot open",
      )
    }
    await expect(openBrowser(launch, {}, "/libs", () => false)).rejects.toThrow(/libatk-1\.0\.so\.0 is missing/)
  })
})

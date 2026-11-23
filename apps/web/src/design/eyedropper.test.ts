import { afterEach, describe, expect, it, vi } from "vitest"
import { dropperOf, pickScreenColor, type Dropper } from "@/design/eyedropper"

const hex = (digits: string) => `#${digits}`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("eyedropper API wrapper", () => {
  it("returns undefined and null when window.EyeDropper is absent", async () => {
    vi.stubGlobal("window", {})
    expect(dropperOf()).toBeUndefined()
    expect(await pickScreenColor()).toBeNull()
  })

  it("opens window.EyeDropper with the abort signal and parses its sRGBHex color", async () => {
    let seenSignal: AbortSignal | undefined
    class FakeDropper implements Dropper {
      open(options?: { readonly signal?: AbortSignal }) {
        seenSignal = options?.signal
        return Promise.resolve({ sRGBHex: hex("1e40af") })
      }
    }
    vi.stubGlobal("window", { EyeDropper: FakeDropper })
    const controller = new AbortController()
    expect(dropperOf()).toBe(FakeDropper)
    expect(await pickScreenColor(controller.signal)).toBe(hex("1e40af"))
    expect(seenSignal).toBe(controller.signal)
  })

  it("returns null on cancellation or invalid sRGBHex", async () => {
    class AbortedDropper implements Dropper {
      open() {
        return Promise.reject(new DOMException("aborted", "AbortError"))
      }
    }
    vi.stubGlobal("window", { EyeDropper: AbortedDropper })
    expect(await pickScreenColor()).toBeNull()

    class BadDropper implements Dropper {
      open() {
        return Promise.resolve({ sRGBHex: "not-a-color" })
      }
    }
    vi.stubGlobal("window", { EyeDropper: BadDropper })
    expect(await pickScreenColor()).toBeNull()
  })
})

import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { OAuthAuthorize } from "@/connect/oauth-authorize"

it("does not paint consent before the client rule answers", () => {
  expect(renderToStaticMarkup(<OAuthAuthorize />)).toBe("")
})

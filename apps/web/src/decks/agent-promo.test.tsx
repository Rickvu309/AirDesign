import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, it, vi } from "vitest"
import { AgentPromo } from "@/decks/agent-promo"
import { accountCopy } from "@/copy/account-copy"

afterEach(() => {
  vi.unstubAllGlobals()
})

const card = () => renderToStaticMarkup(<AgentPromo onConnect={() => {}} ornaments={false} />)

it("cuts the holes in the Codex and Cursor logos instead of painting them solid", () => {
  const html = card()
  expect(html.match(/fill-rule="evenodd"/g)).toHaveLength(2)
})

it("draws the AirDesign tile with the AirDesign mark", () => {
  expect(card()).toContain('d="M13 57l19-50 19 50"')
})

it("offers a button that collapses the card", () => {
  expect(card()).toMatch(new RegExp(`<button type="button" aria-label="${accountCopy.agentCardCollapse}"`))
})

it("shows only the Connect an agent button, on the sidebar's color with a border, once collapsed", () => {
  vi.stubGlobal("localStorage", { getItem: () => "collapsed", setItem() {} })
  const html = card()
  expect(html).not.toContain("Bring your own agent")
  const button = html
    .match(/<button type="button" class="([^"]*)"[^>]*>[^]*Connect an agent<\/button>$/)?.[1]
    ?.split(" ")
  expect(button).toContain("bg-canvas")
  expect(button).toContain("border-field-edge")
  expect(button).not.toContain("bg-background")
})

it("opens the connect dialog from the signature button, never a link to another page", () => {
  const html = card()
  const button = html.match(/<button type="button" class="([^"]*)"[^>]*>[^]*?Connect an agent<\/button>/)?.[1]
  expect(button).toContain("bg-[image:var(--fill-signature)]")
  expect(html).not.toContain("<a ")
})

it("keeps a design screen's card a link to its sample screen", () => {
  expect(renderToStaticMarkup(<AgentPromo />)).toContain('<a href="/screens/s71-01-agents-connect-approve-claude"')
})
